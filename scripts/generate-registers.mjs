// generate-registers.mjs — renders assets/generated/{station,cargo}.svg
// from live GitHub data. Runs in Actions with GITHUB_TOKEN; no dependencies.
import { mkdir, writeFile } from "node:fs/promises";

const USER = "divcodes1121";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error("GITHUB_TOKEN missing"); process.exit(1); }

const H = {
  Authorization: `bearer ${TOKEN}`,
  "User-Agent": USER,
  Accept: "application/vnd.github+json",
};

async function gql(query) {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST", headers: H, body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`graphql ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}
async function rest(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers: H });
  if (!r.ok) throw new Error(`rest ${path} ${r.status}`);
  return r.json();
}

// ── data ────────────────────────────────────────────────────────────
const cal = await gql(`query { user(login: "${USER}") {
  followers { totalCount }
  contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount } }
  } } } }`);

const calendar = cal.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap(w => w.contributionDays);
const total = calendar.totalContributions;
const followers = cal.user.followers.totalCount;

let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; if (run > longest) longest = run; }
let cur = 0;
let i = days.length - 1;
if (days[i] && days[i].contributionCount === 0) i--; // today may still be empty
for (; i >= 0 && days[i].contributionCount > 0; i--) cur++;
const today = days[days.length - 1]?.contributionCount ?? 0;
const last14 = days.slice(-14);

const me = await rest(`/users/${USER}`);
const repos = await rest(`/users/${USER}/repos?per_page=100`);
const own = repos.filter(r => !r.fork);
const bytes = {};
for (const r of own) {
  try {
    const langs = await rest(`/repos/${USER}/${r.name}/languages`);
    for (const [k, v] of Object.entries(langs)) bytes[k] = (bytes[k] || 0) + v;
  } catch { /* skip empty repos */ }
}
const totalBytes = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 9)
  .map(([name, b]) => ({ name, pct: Math.max(1, Math.round((b / totalBytes) * 100)) }));

console.log({ total, cur, longest, today, followers, repos: me.public_repos, top });

// ── shared bits ─────────────────────────────────────────────────────
const MONO = "Consolas, 'SF Mono', Menlo, monospace";
const nf = new Intl.NumberFormat("en-US");

// ── station.svg — command deck telemetry ───────────────────────────
const ratio = Math.min(cur / 21, 1);           // 21-day fuel tank
const fillH = Math.max(6, Math.round(162 * ratio));
const mx = Math.max(...last14.map(d => d.contributionCount), 1);
const bars = last14.map((d, k) => {
  const h = Math.max(3, Math.round((d.contributionCount / mx) * 44));
  const x = 268 + k * 20;
  const cls = k === last14.length - 1 ? "bar flick" : "bar";
  return `<rect class="${cls}" x="${x}" y="${248 - h}" width="12" height="${h}" rx="2" fill="${k % 2 ? "#00D9FF" : "#8A2BE2"}" opacity=".85" style="animation-delay:${(k * 0.06).toFixed(2)}s"/>`;
}).join("\n    ");

const station = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 880 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fuel" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#8A2BE2"/><stop offset="1" stop-color="#00D9FF"/>
    </linearGradient>
    <clipPath id="tank"><rect x="56" y="84" width="56" height="166" rx="8"/></clipPath>
    <style>
      .mono { font-family: ${MONO}; }
      .blink { animation: blink 2.2s steps(1) infinite; }
      .b2 { animation-delay: .7s; } .b3 { animation-delay: 1.4s; }
      @keyframes blink { 0%,60% { opacity: 1; } 61%,100% { opacity: .25; } }
      .bub { animation: bub 3.4s linear infinite; }
      .u2 { animation-delay: 1.1s; } .u3 { animation-delay: 2.3s; }
      @keyframes bub { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: .8; } 88% { opacity: .8; } 100% { transform: translateY(-${fillH - 8}px); opacity: 0; } }
      .orbit { transform-box: view-box; transform-origin: 728px 150px; animation: orbit 9s linear infinite; }
      @keyframes orbit { to { transform: rotate(360deg); } }
      .bar { transform-box: fill-box; transform-origin: bottom; animation: rise 12s ease infinite; }
      @keyframes rise { 0% { transform: scaleY(0); } 4% { transform: scaleY(1); } 94% { transform: scaleY(1); } 98%,100% { transform: scaleY(0); } }
      .flick { animation: rise 12s ease infinite, flick .5s steps(2) infinite; }
      @keyframes flick { 50% { opacity: .5; } }
      .shoot { animation: shoot 7s ease-in infinite; opacity: 0; }
      @keyframes shoot { 0%,72% { opacity: 0; transform: translate(0,0); } 74% { opacity: .9; } 82%,100% { opacity: 0; transform: translate(-130px,64px); } }
      .breathe { transform-box: fill-box; transform-origin: center; animation: breathe 4s ease-in-out infinite alternate; }
      @keyframes breathe { to { transform: scale(1.05); } }
    </style>
  </defs>

  <rect x="1" y="1" width="878" height="298" rx="14" fill="#0D1117" stroke="#21262D" stroke-width="1.5"/>
  <line class="shoot" x1="820" y1="34" x2="850" y2="20" stroke="#E6EDF3" stroke-width="1.2"/>

  <text x="36" y="42" class="mono" font-size="11" letter-spacing="4" fill="#7D8590">COMMAND DECK — LIVE TELEMETRY</text>
  <circle class="blink" cx="806" cy="38" r="3.5" fill="#3FB950"/>
  <circle class="blink b2" cx="822" cy="38" r="3.5" fill="#8A2BE2"/>
  <circle class="blink b3" cx="838" cy="38" r="3.5" fill="#00D9FF"/>
  <path d="M 36 56 H 844" stroke="#21262D" stroke-width="1"/>

  <!-- fuel core: streak -->
  <rect x="56" y="84" width="56" height="166" rx="8" fill="#161B22" stroke="#30363D" stroke-width="1.5"/>
  <g clip-path="url(#tank)">
    <rect x="56" y="${250 - fillH}" width="56" height="${fillH}" fill="url(#fuel)" opacity=".9"/>
    <circle class="bub" cx="72" cy="${244}" r="3" fill="#E6EDF3" opacity=".8"/>
    <circle class="bub u2" cx="88" cy="${246}" r="2" fill="#E6EDF3" opacity=".8"/>
    <circle class="bub u3" cx="98" cy="${245}" r="2.5" fill="#E6EDF3" opacity=".8"/>
  </g>
  <line x1="112" y1="${250 - 162}" x2="120" y2="${250 - 162}" stroke="#30363D"/><text x="126" y="${254 - 162}" class="mono" font-size="8" fill="#30363D">21d</text>
  <line x1="112" y1="${250 - 81}" x2="120" y2="${250 - 81}" stroke="#30363D"/><text x="126" y="${254 - 81}" class="mono" font-size="8" fill="#30363D">10d</text>
  <text x="84" y="272" text-anchor="middle" class="mono" font-size="11" fill="#A1A1AA">FUEL CORE</text>
  <text x="84" y="288" text-anchor="middle" class="mono" font-size="12" fill="#FFFFFF">${cur}-day streak</text>

  <!-- center: contributions -->
  <text x="380" y="132" text-anchor="middle" class="mono" font-size="58" font-weight="bold" fill="#FFFFFF">${nf.format(total)}</text>
  <text x="380" y="158" text-anchor="middle" class="mono" font-size="11" letter-spacing="3" fill="#7D8590">CONTRIBUTIONS — PAST YEAR</text>
  <text x="380" y="184" text-anchor="middle" class="mono" font-size="12">
    <tspan fill="#00D9FF">today +${today}</tspan><tspan fill="#30363D">&#160;&#160;·&#160;&#160;</tspan><tspan fill="#A1A1AA">longest ${longest}d</tspan><tspan fill="#30363D">&#160;&#160;·&#160;&#160;</tspan><tspan fill="#A1A1AA">${(total / 365).toFixed(1)}/day</tspan>
  </text>

  <!-- thrusters: last 14 days -->
  <text x="268" y="214" class="mono" font-size="9" letter-spacing="2" fill="#30363D">THRUSTERS — LAST 14 DAYS</text>
  <line x1="268" y1="250" x2="528" y2="250" stroke="#21262D"/>
    ${bars}

  <!-- planet: repos + followers -->
  <circle class="breathe" cx="728" cy="150" r="40" fill="#161B22" stroke="#30363D" stroke-width="1.5"/>
  <ellipse cx="728" cy="150" rx="58" ry="14" fill="none" stroke="#8A2BE2" stroke-width="1.2" stroke-opacity=".55" transform="rotate(-16 728 150)"/>
  <g class="orbit"><circle cx="786" cy="136" r="3" fill="#00D9FF"/></g>
  <text x="728" y="146" text-anchor="middle" class="mono" font-size="17" fill="#FFFFFF">${me.public_repos}</text>
  <text x="728" y="162" text-anchor="middle" class="mono" font-size="9" letter-spacing="1" fill="#7D8590">REPOS</text>
  <text x="728" y="236" text-anchor="middle" class="mono" font-size="12" fill="#A1A1AA">${followers} follower${followers === 1 ? "" : "s"} in orbit</text>
  <text x="728" y="272" text-anchor="middle" class="mono" font-size="10" fill="#30363D">sector: lucknow, in</text>
</svg>
`;

// ── cargo.svg — minecraft cargo hold, languages by volume ──────────
const ORE = ["#8A2BE2", "#00D9FF", "#A78BFA", "#67E8F9", "#E6EDF3", "#8A2BE2", "#00D9FF", "#A78BFA", "#67E8F9"];
const SPECK = [[8, 8], [22, 12], [12, 22], [26, 26], [17, 17]]; // ore speckle offsets in 40px block
const slotX = k => 120 + k * 72;

const slots = Array.from({ length: 9 }, (_, k) => {
  const s = top[k];
  const x = slotX(k);
  let inner = "";
  if (s) {
    const specks = SPECK.map(([sx, sy], j) =>
      `<rect x="${x + 12 + sx}" y="${82 + sy}" width="6" height="6" fill="${ORE[k]}" opacity="${j % 2 ? ".95" : ".7"}"/>`).join("");
    inner = `
    <rect x="${x + 12}" y="82" width="40" height="40" fill="#21262D"/>
    ${specks}
    <rect x="${x + 12}" y="82" width="40" height="4" fill="#FFFFFF" opacity=".06"/>
    <text x="${x + 56}" y="126" text-anchor="end" class="mono" font-size="12" font-weight="bold" fill="#FFFFFF">${s.pct}</text>
    <text x="${x + 32}" y="148" text-anchor="middle" class="mono" font-size="9" fill="#A1A1AA">${s.name.toLowerCase().slice(0, 10)}</text>`;
  }
  return `<rect x="${x}" y="70" width="64" height="64" fill="#161B22" stroke="#30363D" stroke-width="2"/>${inner}`;
}).join("\n  ");

const cursorStops = Array.from({ length: 9 }, (_, k) =>
  `${(k * 11).toFixed(1)}%, ${(k * 11 + 8).toFixed(1)}% { transform: translateX(${k * 72}px); }`).join("\n      ");

const cargo = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <defs>
    <style>
      .mono { font-family: ${MONO}; }
      .cursor { animation: cur 20s steps(1) infinite; }
      @keyframes cur {
      ${cursorStops}
      100% { transform: translateX(0); }
      }
      .spark { animation: spark 2.6s steps(2) infinite; }
      .s2 { animation-delay: 1.2s; }
      @keyframes spark { 0%,70% { opacity: 0; } 75%,95% { opacity: 1; } 100% { opacity: 0; } }
      .hum { animation: hum 3s ease-in-out infinite alternate; }
      @keyframes hum { from { opacity: .4; } to { opacity: 1; } }
    </style>
  </defs>

  <rect x="1" y="1" width="878" height="258" rx="14" fill="#0D1117" stroke="#21262D" stroke-width="1.5"/>

  <text x="36" y="42" class="mono" font-size="11" letter-spacing="4" fill="#7D8590">CARGO HOLD — LANGUAGE ORE, BY VOLUME MINED</text>
  <text x="844" y="42" text-anchor="end" class="mono hum" font-size="10" fill="#00D9FF">● capacity: ∞</text>
  <path d="M 36 56 H 844" stroke="#21262D" stroke-width="1"/>

  ${slots}

  <!-- selection cursor -->
  <g class="cursor">
    <path d="M 118 68 h 10 M 118 68 v 10 M 186 68 h -10 M 186 68 v 10 M 118 136 h 10 M 118 136 v -10 M 186 136 h -10 M 186 136 v -10"
          stroke="#FFFFFF" stroke-width="3" fill="none"/>
  </g>

  <!-- sparkles -->
  <rect class="spark" x="${slotX(0) + 40}" y="86" width="4" height="4" fill="#FFFFFF"/>
  <rect class="spark s2" x="${slotX(1) + 18}" y="104" width="4" height="4" fill="#FFFFFF"/>

  <text x="36" y="196" class="mono" font-size="10" fill="#30363D">numbers show share of mined volume (%) across ${own.length} original repositories</text>
  <text x="36" y="232" class="mono" font-size="11" fill="#A1A1AA">total ore: ${(totalBytes / 1048576).toFixed(1)} MB<tspan fill="#30363D">&#160;&#160;·&#160;&#160;</tspan><tspan fill="#7D8590">rarest find: ${top[top.length - 1]?.name.toLowerCase() ?? "?"}</tspan></text>
  <text x="844" y="232" text-anchor="end" class="mono" font-size="10" fill="#30363D">hotbar — select wisely</text>
</svg>
`;

await mkdir("assets/generated", { recursive: true });
await writeFile("assets/generated/station.svg", station);
await writeFile("assets/generated/cargo.svg", cargo);
console.log("wrote assets/generated/station.svg, cargo.svg");
