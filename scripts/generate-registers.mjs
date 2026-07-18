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

// ── forge.svg — leetcode, problems hammered into solutions ─────────
// LeetCode's GraphQL is unofficial and may reject datacenter IPs; on
// failure we keep the previous forge.svg and still succeed the job.
let forge = null;
try {
  const lcq = {
    query: `query { allQuestionsCount { difficulty count }
      matchedUser(username: "Div_Codes1121") {
        profile { ranking }
        submitStatsGlobal { acSubmissionNum { difficulty count } } } }`,
  };
  const lr = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify(lcq),
  });
  if (!lr.ok) throw new Error(`leetcode ${lr.status}`);
  const lj = await lr.json();
  const all = Object.fromEntries(lj.data.allQuestionsCount.map(x => [x.difficulty, x.count]));
  const ac = Object.fromEntries(lj.data.matchedUser.submitStatsGlobal.acSubmissionNum.map(x => [x.difficulty, x.count]));
  const rank = lj.data.matchedUser.profile.ranking;
  const solved = ac.All ?? 0;
  const diffs = [
    { label: "easy",   n: ac.Easy ?? 0,   of: all.Easy,   color: "#00D9FF" },
    { label: "medium", n: ac.Medium ?? 0, of: all.Medium, color: "#8A2BE2" },
    { label: "hard",   n: ac.Hard ?? 0,   of: all.Hard,   color: "#E6EDF3" },
  ];
  const dmax = Math.max(...diffs.map(d => d.n), 1);
  console.log({ solved, rank, diffs: diffs.map(d => `${d.label}:${d.n}`) });

  const rows = diffs.map((d, k) => {
    const y = 118 + k * 52;
    const w = Math.max(8, Math.round((d.n / dmax) * 250));
    return `
  <text x="560" y="${y}" class="mono" font-size="12" fill="#A1A1AA">${d.label}</text>
  <rect x="560" y="${y + 12}" width="250" height="7" rx="3.5" fill="#161B22" stroke="#21262D" stroke-width="1"/>
  <rect class="heat h${k + 1}" x="560" y="${y + 12}" width="${w}" height="7" rx="3.5" fill="${d.color}" opacity=".9"/>
  <text x="844" y="${y}" text-anchor="end" class="mono" font-size="13" fill="#FFFFFF">${d.n}<tspan fill="#30363D" font-size="10"> / ${d.of}</tspan></text>`;
  }).join("\n");

  forge = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 880 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ingot" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8A2BE2"/><stop offset="1" stop-color="#00D9FF"/>
    </linearGradient>
    <style>
      .mono { font-family: ${MONO}; }
      .px { shape-rendering: crispEdges; }
      .hammer { transform-box: view-box; transform-origin: 208px 148px;
                animation: strike 2.8s cubic-bezier(.6,0,.9,1) infinite; }
      @keyframes strike {
        0% { transform: rotate(-52deg); } 55% { transform: rotate(-52deg); }
        63%, 74% { transform: rotate(0deg); } 100% { transform: rotate(-52deg); }
      }
      .spark { opacity: 0; animation: spark 2.8s linear infinite; }
      @keyframes spark {
        0%, 62% { opacity: 0; transform: translate(0,0); }
        64% { opacity: 1; }
        76%, 100% { opacity: 0; transform: translate(var(--dx), var(--dy)); }
      }
      .glow { animation: glow 2.8s ease infinite; }
      @keyframes glow { 0%,60% { opacity: .55; } 64%,76% { opacity: 1; } 100% { opacity: .55; } }
      .heat { transform-box: fill-box; transform-origin: left center; transform: scaleX(0);
              animation: heat 12s cubic-bezier(.25,0,.2,1) infinite; }
      .h1 { animation-delay: .15s; } .h2 { animation-delay: .35s; } .h3 { animation-delay: .55s; }
      @keyframes heat { 0% { transform: scaleX(0); } 8% { transform: scaleX(1); } 93% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
      .flame { animation: flame .55s steps(2) infinite; }
      @keyframes flame { 50% { opacity: .45; } }
    </style>
  </defs>

  <rect x="1" y="1" width="878" height="298" rx="14" fill="#0D1117" stroke="#21262D" stroke-width="1.5"/>

  <text x="36" y="42" class="mono" font-size="11" letter-spacing="4" fill="#7D8590">THE FORGE — PROBLEMS HAMMERED INTO SOLUTIONS</text>
  <text x="844" y="42" text-anchor="end" class="mono flame" font-size="10" fill="#00D9FF">● furnace: lit</text>
  <path d="M 36 56 H 844" stroke="#21262D" stroke-width="1"/>

  <!-- anvil scene -->
  <g class="px">
    <rect x="120" y="236" width="120" height="22" fill="#161B22"/>
    <rect x="132" y="224" width="96"  height="12" fill="#21262D"/>
    <rect x="150" y="196" width="60"  height="16" fill="#30363D"/>
    <rect x="142" y="180" width="92"  height="16" fill="#3D444D"/>
    <rect x="234" y="184" width="18"  height="8"  fill="#3D444D"/>
    <rect x="128" y="184" width="14"  height="10" fill="#30363D"/>
    <rect class="glow" x="168" y="170" width="44" height="10" fill="url(#ingot)"/>
  </g>
  <g class="hammer px">
    <rect x="200" y="142" width="52" height="10" rx="2" fill="#21262D"/>
    <rect x="246" y="130" width="26" height="32" fill="#3D444D"/>
    <rect x="246" y="130" width="26" height="6"  fill="#4B535D"/>
  </g>
  <rect class="spark px" style="--dx:16px;--dy:-20px"  x="204" y="164" width="4" height="4" fill="#00D9FF"/>
  <rect class="spark px" style="--dx:-14px;--dy:-16px" x="196" y="166" width="3" height="3" fill="#8A2BE2"/>
  <rect class="spark px" style="--dx:22px;--dy:-8px"   x="208" y="168" width="3" height="3" fill="#E6EDF3"/>
  <rect class="spark px" style="--dx:-8px;--dy:-24px"  x="200" y="162" width="3" height="3" fill="#00D9FF"/>
  <text x="180" y="282" text-anchor="middle" class="mono" font-size="10" fill="#30363D">forge temp: 100°C — coffee-quenched</text>

  <!-- totals -->
  <text x="420" y="140" text-anchor="middle" class="mono" font-size="56" font-weight="bold" fill="#FFFFFF">${nf.format(solved)}</text>
  <text x="420" y="166" text-anchor="middle" class="mono" font-size="11" letter-spacing="3" fill="#7D8590">PROBLEMS SOLVED — ALL TIME</text>
  <text x="420" y="194" text-anchor="middle" class="mono" font-size="12">
    <tspan fill="#00D9FF">global rank #${nf.format(rank)}</tspan><tspan fill="#30363D">&#160;&#160;·&#160;&#160;</tspan><tspan fill="#A1A1AA">armory of ${nf.format(all.All)}</tspan>
  </text>

  <!-- difficulty bars -->
${rows}
  <text x="560" y="262" class="mono" font-size="10" fill="#30363D">bars scaled to strongest difficulty · counts are live</text>
</svg>
`;
} catch (e) {
  console.warn(`forge skipped: ${e.message} — previous forge.svg kept`);
}

await mkdir("assets/generated", { recursive: true });
await writeFile("assets/generated/station.svg", station);
await writeFile("assets/generated/cargo.svg", cargo);
if (forge) await writeFile("assets/generated/forge.svg", forge);
console.log(`wrote station.svg, cargo.svg${forge ? ", forge.svg" : ""}`);
