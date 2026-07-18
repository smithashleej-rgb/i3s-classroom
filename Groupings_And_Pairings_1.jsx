import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   GROUPINGS & PAIRINGS — sociogram-driven grouping studio
   CPS · B9 · standalone tool · Chunk & Check aesthetic

   · Student Profile layer: curriculum levels per subject,
     strengths/needs, learning needs, keep-together / keep-apart,
     student–teacher recommendations, centre band
   · Sociogram as the shared data layer — reciprocated vs one-way
     links, clusters, isolates — feeds every generator
   · Four generators, one engine:
       – Class creator (balance levels, honour pairings/separations,
         spread needs, respect centre boundary)
       – N/E/S/W partners (each direction its own criterion:
         N = same level in a subject · E = friends who work well ·
         S = mixed level · W = choose your own rule)
       – Activity / cabin groups (n groups or group size)
   · Constraint transparency — every result shows what was
     satisfied and what was traded off
   · Manual override with re-balance on every grouping
   · Per-student partner cards, printable
   · Import a cohort (text/docx/xlsx/pdf/image); autosave + JSON
   ============================================================ */

/* ---------- design tokens (Chunk & Check) ---------- */
const T = {
  bg: "#F6F8FB", card: "#FFFFFF", line: "#E6EBF2", lineSoft: "#EEF2F7",
  ink: "#0F172A", sub: "#64748B", faint: "#94A3B8",
  blue: "#2563EB", blueDeep: "#1D4ED8", blueSoft: "#EFF6FF", blueLine: "#BFDBFE",
  amber: "#B45309", amberSoft: "#FFFBEB", amberLine: "#FDE68A",
  green: "#047857", greenSoft: "#ECFDF5", greenLine: "#A7F3D0",
  red: "#B91C1C", redSoft: "#FEF2F2", redLine: "#FECACA",
  shadow: "0 1px 2px rgba(15,23,42,.05), 0 4px 14px rgba(15,23,42,.05)",
  shadowLift: "0 2px 4px rgba(15,23,42,.06), 0 10px 30px rgba(15,23,42,.09)",
};
const F = { display: "'Plus Jakarta Sans', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" };
const S = {
  card: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, boxShadow: T.shadow, padding: 18 },
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint },
  pill: { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 14px", background: T.card, border: `1px solid ${T.line}`, boxShadow: "0 1px 2px rgba(15,23,42,.05)", fontFamily: F.body, fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap" },
  btn: { cursor: "pointer", border: "none", borderRadius: 999, padding: "9px 18px", background: T.blue, color: "#FFFFFF", fontFamily: F.body, fontSize: 13, fontWeight: 700, boxShadow: "0 1px 2px rgba(37,99,235,.35), 0 6px 16px rgba(37,99,235,.25)" },
  btnGhost: { cursor: "pointer", borderRadius: 999, padding: "8px 16px", background: T.card, color: T.ink, border: `1px solid ${T.line}`, fontFamily: F.body, fontSize: 12.5, fontWeight: 600, boxShadow: "0 1px 2px rgba(15,23,42,.05)" },
  input: { width: "100%", borderRadius: 12, border: `1px solid ${T.line}`, padding: "10px 12px", fontFamily: F.body, fontSize: 13.5, color: T.ink, background: T.card, outline: "none" },
  label: { fontFamily: F.body, fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 6, display: "block" },
};
const Pill = ({ children, tone = "plain", style = {} }) => {
  const tones = { plain: {}, blue: { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep }, amber: { background: T.amberSoft, borderColor: T.amberLine, color: T.amber }, green: { background: T.greenSoft, borderColor: T.greenLine, color: T.green }, red: { background: T.redSoft, borderColor: T.redLine, color: T.red }, ink: { background: T.ink, borderColor: T.ink, color: "#FFFFFF" } };
  return <span style={{ ...S.pill, ...tones[tone], ...style }}>{children}</span>;
};

/* level colours (CPS ladder) */
const LEVEL_COLORS = {
  0: { main: "#D9C58C", text: "#8A6D1F", soft: "#FBF6E7", line: "#EBDFBA" },
  1: { main: "#EC4899", text: "#BE185D", soft: "#FDF2F8", line: "#FBCFE8" },
  2: { main: "#EF4444", text: "#B91C1C", soft: "#FEF2F2", line: "#FECACA" },
  3: { main: "#F97316", text: "#C2410C", soft: "#FFF7ED", line: "#FED7AA" },
  4: { main: "#EAB308", text: "#A16207", soft: "#FEFCE8", line: "#FDE68A" },
  5: { main: "#22C55E", text: "#15803D", soft: "#F0FDF4", line: "#BBF7D0" },
  6: { main: "#3B82F6", text: "#1D4ED8", soft: "#EFF6FF", line: "#BFDBFE" },
  7: { main: "#6366F1", text: "#4338CA", soft: "#EEF2FF", line: "#C7D2FE" },
  8: { main: "#14B8A6", text: "#0F766E", soft: "#F0FDFA", line: "#99F6E4" },
};
const levelColor = (l) => LEVEL_COLORS[Number(l)] || LEVEL_COLORS[6];

const GROUP_TINTS = ["#EFF6FF", "#F5F3FF", "#FDF2F8", "#FFF7ED", "#F0FDFA", "#F0FDF4", "#EEF2FF", "#FEFCE8"];
const GROUP_MAIN = ["#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#0D9488", "#16A34A", "#4F46E5", "#CA8A04"];

const SUBJECTS = ["Reading", "Writing", "Number & Algebra", "Measurement & Space", "Spelling"];
const NEEDS = ["EAL", "ADHD", "Dyslexia", "Dysgraphia", "Dyscalculia", "IEP", "Support", "Extension"];
const CENTRES = [
  { id: "creativity", name: "Creativity (P–2)", cross: false },
  { id: "innovation", name: "Innovation (3–4)", cross: true },
  { id: "leadership", name: "Leadership (5–6)", cross: true },
];
const STORAGE_KEY = "i3s-groupings-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- API + file helpers ---------- */
async function askClaude(messages, maxTokens = 5000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
const parseJSON = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());
const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("Read failed")); r.readAsDataURL(file); });
const fileToText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = () => rej(new Error("Read failed")); r.readAsText(file); });
async function extractSourceText(file) {
  const name = (file.name || "").toLowerCase(); const ext = name.split(".").pop();
  if (["txt", "md", "csv", "tsv"].includes(ext) || file.type.startsWith("text/")) return await fileToText(file);
  if (ext === "docx") { const mammoth = await import("mammoth"); return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || ""; }
  if (["xlsx", "xls"].includes(ext)) { const XLSX = await import("xlsx"); const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); return wb.SheetNames.map((sn) => `--- Sheet: ${sn} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}`).join("\n\n"); }
  if (ext === "pdf" || file.type === "application/pdf") { const b64 = await fileToBase64(file); return await askClaude([{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }, { type: "text", text: "Extract ALL text verbatim, preserving any table structure. Output ONLY the text." }] }], 6000); }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || file.type.startsWith("image/")) { const media = file.type?.startsWith("image/") ? file.type : ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "image/png"); const b64 = await fileToBase64(file); return await askClaude([{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: media, data: b64 } }, { type: "text", text: "Transcribe ALL text verbatim, preserving table structure. Output ONLY the transcription." }] }], 6000); }
  throw new Error(`Can't read .${ext}`);
}

/* ---------- sociogram helpers ---------- */
function friendGraph(students) {
  // edge weight: reciprocated = 2, one-way = 1
  const likes = {};
  students.forEach((s) => (likes[s.id] = new Set(s.friends || [])));
  const edge = (a, b) => (likes[a]?.has(b) ? 1 : 0) + (likes[b]?.has(a) ? 1 : 0);
  return { likes, edge };
}
function sociogramStats(students) {
  const { likes } = friendGraph(students);
  const inbound = {};
  students.forEach((s) => (inbound[s.id] = 0));
  students.forEach((s) => (s.friends || []).forEach((f) => { if (inbound[f] != null) inbound[f]++; }));
  const stats = students.map((s) => {
    const out = (s.friends || []).filter((f) => students.some((x) => x.id === f));
    const recip = out.filter((f) => likes[f]?.has(s.id));
    return { id: s.id, out: out.length, inbound: inbound[s.id] || 0, recip: recip.length, recipIds: recip };
  });
  const isolates = stats.filter((x) => x.recip === 0 && x.inbound === 0).map((x) => x.id);
  return { stats, isolates, inbound };
}

/* ---------- grouping engine ---------- */
const between = (a, b, sep) => (sep[a]?.has(b) || sep[b]?.has(a));
function buildSep(students) {
  const sep = {};
  students.forEach((s) => (sep[s.id] = new Set(s.keepApart || [])));
  // symmetric
  students.forEach((s) => (s.keepApart || []).forEach((o) => { if (sep[o]) sep[o].add(s.id); }));
  return sep;
}
function keepTogetherClusters(pool) {
  // union-find over keepWith
  const parent = {}; pool.forEach((s) => (parent[s.id] = s.id));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  pool.forEach((s) => (s.keepWith || []).forEach((o) => { if (parent[o] != null) union(s.id, o); }));
  const groups = {};
  pool.forEach((s) => { const r = find(s.id); (groups[r] = groups[r] || []).push(s); });
  return Object.values(groups);
}

function generateClasses({ students, nClasses, balanceSubject, sep }) {
  const buckets = Array.from({ length: nClasses }, () => []);
  const clusters = keepTogetherClusters(students)
    .sort((a, b) => avgLevel(b, balanceSubject) - avgLevel(a, balanceSubject)); // seed by level, snake for spread
  const load = () => buckets.map((b) => b.flat().length);
  const levelSum = (bi) => buckets[bi].flat().reduce((t, s) => t + (Number(s.levels?.[balanceSubject]) || 0), 0);
  const needCount = (bi, need) => buckets[bi].flat().filter((s) => (s.needs || []).includes(need)).length;
  for (const cluster of clusters) {
    // pick the bucket that (a) has no separation conflict, (b) is smallest, (c) lowest level sum, (d) fewest shared needs
    let best = -1, bestScore = Infinity;
    for (let bi = 0; bi < nClasses; bi++) {
      const members = buckets[bi].flat();
      const conflict = cluster.some((c) => members.some((m) => between(c.id, m.id, sep)));
      const sizePenalty = load()[bi] * 10;
      const levelPenalty = levelSum(bi);
      const needPenalty = NEEDS.reduce((t, n) => t + (cluster.some((c) => (c.needs || []).includes(n)) ? needCount(bi, n) * 2 : 0), 0);
      const score = (conflict ? 100000 : 0) + sizePenalty + levelPenalty * 0.5 + needPenalty;
      if (score < bestScore) { bestScore = score; best = bi; }
    }
    buckets[best].push(cluster);
  }
  return buckets.map((b) => b.flat());
}
const avgLevel = (arr, subj) => (arr.length ? arr.reduce((t, s) => t + (Number(s.levels?.[subj]) || 0), 0) / arr.length : 0);

/* N/E/S/W partner allocation — one directed criterion per direction */
function allocatePartners(students, { subject, mode }) {
  // mode: 'same' | 'mixed' | 'friend'
  const { likes } = friendGraph(students);
  const pool = [...students];
  const pairs = [];
  const used = new Set();
  const score = (a, b) => {
    const la = Number(a.levels?.[subject]) || 0, lb = Number(b.levels?.[subject]) || 0;
    let s = 0;
    if (mode === "same") s -= Math.abs(la - lb) * 4;
    if (mode === "mixed") s += Math.abs(la - lb) * 2;
    if (mode === "friend") s += (likes[a.id]?.has(b.id) ? 1 : 0) + (likes[b.id]?.has(a.id) ? 1 : 0) ? ((likes[a.id]?.has(b.id) ? 2 : 0) + (likes[b.id]?.has(a.id) ? 2 : 0)) : 0;
    if ((a.keepApart || []).includes(b.id) || (b.keepApart || []).includes(a.id)) s -= 1000;
    return s;
  };
  const order = mode === "friend" ? pool.sort((a, b) => (a.friends?.length || 0) - (b.friends?.length || 0)) : pool;
  for (const a of order) {
    if (used.has(a.id)) continue;
    let best = null, bestSc = -Infinity;
    for (const b of pool) {
      if (b.id === a.id || used.has(b.id)) continue;
      const sc = score(a, b);
      if (sc > bestSc) { bestSc = sc; best = b; }
    }
    if (best) { pairs.push([a, best, bestSc]); used.add(a.id); used.add(best.id); }
    else pairs.push([a, null, 0]);
  }
  return pairs;
}

function generateGroups({ students, nGroups, sep, mode }) {
  const buckets = Array.from({ length: nGroups }, () => []);
  const clusters = keepTogetherClusters(students);
  const { edge } = friendGraph(students);
  // shuffle-ish deterministic order by a name hash so "random" groups vary yet reproduce
  clusters.sort((a, b) => (b.length - a.length));
  for (const cluster of clusters) {
    let best = -1, bestScore = Infinity;
    for (let bi = 0; bi < nGroups; bi++) {
      const members = buckets[bi].flat();
      const conflict = cluster.some((c) => members.some((m) => between(c.id, m.id, sep)));
      const size = members.length;
      // friend mode wants at least one friendly link; mixed wants to break up cliques
      const friendLinks = cluster.reduce((t, c) => t + members.reduce((u, m) => u + edge(c.id, m.id), 0), 0);
      let social = 0;
      if (mode === "friend") social = -friendLinks; // prefer buckets where friends already are
      if (mode === "mixed") social = friendLinks; // penalise reuniting friends
      const score = (conflict ? 100000 : 0) + size * 10 + social;
      if (score < bestScore) { bestScore = score; best = bi; }
    }
    buckets[best].push(cluster);
  }
  return buckets.map((b) => b.flat());
}

/* constraint audit — what a grouping satisfied / traded off */
function auditGroups(groups, students, { balanceSubject } = {}) {
  const byId = (id) => students.find((s) => s.id === id);
  const kept = [], broke = [], notes = [];
  const groupOf = {};
  groups.forEach((g, gi) => g.forEach((s) => (groupOf[s.id] = gi)));
  for (const s of students) {
    for (const w of s.keepWith || []) {
      if (groupOf[w] == null) continue;
      if (groupOf[w] === groupOf[s.id]) kept.push(`${s.name} + ${byId(w)?.name} together`);
      else broke.push(`${s.name} and ${byId(w)?.name} ended up apart`);
    }
    for (const a of s.keepApart || []) {
      if (groupOf[a] == null) continue;
      if (groupOf[a] === groupOf[s.id]) broke.push(`${s.name} and ${byId(a)?.name} ended up together`);
      else kept.push(`${s.name} away from ${byId(a)?.name}`);
    }
  }
  if (balanceSubject) {
    const avgs = groups.map((g) => avgLevel(g, balanceSubject));
    const spread = Math.max(...avgs) - Math.min(...avgs);
    notes.push(`${balanceSubject} level spread across groups: ${spread.toFixed(2)} (lower = more even)`);
  }
  const sizes = groups.map((g) => g.length);
  notes.push(`Sizes: ${sizes.join(" · ")}`);
  // dedupe symmetric kept/broke lines
  const uniq = (arr) => Array.from(new Set(arr));
  return { kept: uniq(kept), broke: uniq(broke), notes };
}

/* ---------- shared UI ---------- */
const Field = ({ label, children, style = {} }) => (<div style={style}><label style={S.label}>{label}</label>{children}</div>);
const Chip = ({ on, onClick, children, color }) => (
  <button onClick={onClick} style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11, ...(on ? (color ? { background: color.soft, borderColor: color.line, color: color.text } : { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep }) : { color: T.faint }) }}>{children}</button>
);
const Section = ({ eyebrow, title, right, children }) => (
  <div style={{ ...S.card, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      <div><div style={S.eyebrow}>{eyebrow}</div><div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{title}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>
    </div>
    {children}
  </div>
);

/* ============================================================ */
export default function App() {
  const [students, setStudents] = useState([]);
  const [view, setView] = useState("roster");
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [result, setResult] = useState(null); // {kind, groups|pairs, audit, meta}
  const fileRef = useRef(null); const jsonRef = useRef(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const d = JSON.parse(raw); if (d.students) setStudents(d.students); } } catch (e) {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ students })); setSavedFlash(true); const t = setTimeout(() => setSavedFlash(false), 900); return () => clearTimeout(t); } catch (e) {}
  }, [students, loaded]);

  const upStudent = (id, patch) => setStudents((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addStudent = () => setStudents((xs) => [...xs, { id: uid(), name: "", centre: "innovation", levels: {}, needs: [], friends: [], keepWith: [], keepApart: [], teacherRec: "", strengths: "", notes: "" }]);
  const delStudent = (id) => setStudents((xs) => xs.filter((x) => x.id !== id).map((s) => ({ ...s, friends: (s.friends || []).filter((f) => f !== id), keepWith: (s.keepWith || []).filter((f) => f !== id), keepApart: (s.keepApart || []).filter((f) => f !== id) })));
  const sName = (id) => students.find((s) => s.id === id)?.name || "?";

  const exportJSON = () => { const blob = new Blob([JSON.stringify({ students }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cohort.json"; a.click(); };
  const importJSON = async (file) => { try { const d = JSON.parse(await fileToText(file)); setStudents(d.students || []); } catch (e) { alert("Couldn't read that JSON."); } };

  /* ---- AI cohort import ---- */
  const [importText, setImportText] = useState(""); const [importBusy, setImportBusy] = useState(false); const [importMsg, setImportMsg] = useState("");
  async function runImport(sourceText) {
    setImportBusy(true); setImportMsg("Reading and extracting…");
    try {
      const prompt = `Extract a class/cohort of students from the source below into this exact JSON:
{"students":[{"name":"","centre":"creativity|innovation|leadership","levels":{"Reading":4,"Writing":4,"Number & Algebra":5},"needs":["EAL","ADHD"],"friendsByName":["name"],"keepWithByName":["name"],"keepApartByName":["name"],"teacherRecommendation":"","strengths":"","notes":""}]}
Levels are VC2.0 whole numbers 0–8 (Foundation=0). Use only these subject keys where known: ${SUBJECTS.map((s) => `"${s}"`).join(", ")}. Needs from: ${NEEDS.join(", ")}. Names exactly as written. Output ONLY JSON.

SOURCE:
${sourceText}`;
      const data = parseJSON(await askClaude([{ role: "user", content: prompt }], 6000));
      const list = (data.students || []).map((s) => ({ id: uid(), name: s.name || "", centre: s.centre || "innovation", levels: s.levels || {}, needs: s.needs || [], _friends: s.friendsByName || [], _with: s.keepWithByName || [], _apart: s.keepApartByName || [], friends: [], keepWith: [], keepApart: [], teacherRec: s.teacherRecommendation || "", strengths: s.strengths || "", notes: s.notes || "" }));
      const nameId = (n) => list.find((x) => x.name.toLowerCase() === (n || "").toLowerCase())?.id;
      list.forEach((s) => { s.friends = (s._friends).map(nameId).filter(Boolean); s.keepWith = (s._with).map(nameId).filter(Boolean); s.keepApart = (s._apart).map(nameId).filter(Boolean); delete s._friends; delete s._with; delete s._apart; });
      setStudents(list);
      setImportMsg(`Imported ${list.length} students.`); setImportText("");
    } catch (e) { setImportMsg(`Import failed — ${e.message || e}`); }
    setImportBusy(false);
  }

  const soc = sociogramStats(students);
  const sep = buildSep(students);

  /* ---- generators config ---- */
  const [nClasses, setNClasses] = useState(2);
  const [classSubject, setClassSubject] = useState(SUBJECTS[0]);
  const [respectCentre, setRespectCentre] = useState(true);
  const [nGroups, setNGroups] = useState(4);
  const [groupMode, setGroupMode] = useState("mixed");
  const [partnerSubject, setPartnerSubject] = useState(SUBJECTS[2]);

  function runClasses() {
    const active = students.filter((s) => s.name);
    if (respectCentre) {
      // build classes within each centre pool, then concat labelled
      const byCentre = {};
      active.forEach((s) => (byCentre[s.centre] = byCentre[s.centre] || []).push(s));
      const out = [];
      Object.entries(byCentre).forEach(([cid, pool]) => {
        const n = Math.max(1, Math.round(nClasses * (pool.length / active.length)) || 1);
        const gs = generateClasses({ students: pool, nClasses: n, balanceSubject: classSubject, sep });
        gs.forEach((g, i) => out.push({ label: `${CENTRES.find((c) => c.id === cid)?.name.split(" ")[0]} ${i + 1}`, members: g }));
      });
      setResult({ kind: "classes", groups: out.map((o) => o.members), labels: out.map((o) => o.label), audit: auditGroups(out.map((o) => o.members), active, { balanceSubject: classSubject }), meta: { subject: classSubject } });
    } else {
      const gs = generateClasses({ students: active, nClasses, balanceSubject: classSubject, sep });
      setResult({ kind: "classes", groups: gs, labels: gs.map((_, i) => `Class ${i + 1}`), audit: auditGroups(gs, active, { balanceSubject: classSubject }), meta: { subject: classSubject } });
    }
  }
  function runGroups() {
    const active = students.filter((s) => s.name);
    const gs = generateGroups({ students: active, nGroups, sep, mode: groupMode });
    setResult({ kind: "groups", groups: gs, labels: gs.map((_, i) => `Group ${i + 1}`), audit: auditGroups(gs, active), meta: { mode: groupMode } });
  }
  function runPartners() {
    const active = students.filter((s) => s.name);
    const dirs = [
      { dir: "N", label: "North", mode: "same", desc: `Same level in ${partnerSubject}` },
      { dir: "E", label: "East", mode: "friend", desc: "Friends who work well together" },
      { dir: "S", label: "South", mode: "mixed", desc: `Mixed level in ${partnerSubject}` },
      { dir: "W", label: "West", mode: "mixed", desc: "A different mix (your call)" },
    ];
    const byStudent = {};
    active.forEach((s) => (byStudent[s.id] = {}));
    for (const d of dirs) {
      const pairs = allocatePartners(active, { subject: partnerSubject, mode: d.mode });
      pairs.forEach(([a, b]) => { if (a) byStudent[a.id][d.dir] = b?.id || null; if (b) byStudent[b.id][d.dir] = a?.id || null; });
    }
    setResult({ kind: "partners", byStudent, dirs, meta: { subject: partnerSubject } });
  }

  /* manual override: move a student between groups then re-audit */
  const [dragFrom, setDragFrom] = useState(null);
  function moveStudent(sid, toGi) {
    if (!result || result.kind === "partners") return;
    const groups = result.groups.map((g) => g.filter((s) => s.id !== sid));
    const stu = students.find((s) => s.id === sid);
    groups[toGi] = [...groups[toGi], stu];
    const active = students.filter((s) => s.name);
    setResult({ ...result, groups, audit: auditGroups(groups, active, result.kind === "classes" ? { balanceSubject: result.meta.subject } : {}) });
  }

  function printCards() {
    if (!result || result.kind !== "partners") return;
    const dirs = result.dirs;
    const html = `<html><head><title>Partner Cards</title><style>
      body{font-family:'Inter',system-ui,sans-serif;padding:16px;background:#fff;color:#0F172A}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{border:1px solid #E6EBF2;border-radius:14px;padding:14px;page-break-inside:avoid}
      .name{font-weight:800;font-size:18px;margin-bottom:8px}
      .rose{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
      .cell{border:1px solid #EEF2F7;border-radius:10px;padding:8px}
      .dir{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;font-weight:700}
      .partner{font-weight:600}
      @media print{.card{box-shadow:none}}
    </style></head><body><div class="grid">
    ${students.filter((s) => s.name).map((s) => `<div class="card"><div class="name">${s.name}</div><div class="rose">
      ${dirs.map((d) => `<div class="cell"><div class="dir">${d.label} — ${d.desc}</div><div class="partner">${sName(result.byStudent[s.id]?.[d.dir]) || "—"}</div></div>`).join("")}
    </div></div>`).join("")}
    </div><script>window.print()</script></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close();
  }

  const VIEWS = [["roster", "Student Profiles"], ["sociogram", "Sociogram"], ["classes", "Class Creator"], ["partners", "N/E/S/W Partners"], ["groups", "Activity / Cabin Groups"]];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: F.body, color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { border-color: ${T.blueLine} !important; box-shadow: 0 0 0 3px ${T.blueSoft}; }
        button:hover { filter: brightness(.985); }
      `}</style>

      <div style={{ background: T.card, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={S.eyebrow}>CPS · Groupings & Pairings · Standalone Tool</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", margin: "12px 0 6px" }}>Groupings & Pairings</h1>
              <div style={{ color: T.sub, fontSize: 13.5, maxWidth: 660 }}>
                Build classes, N/E/S/W partners and activity groups from one student-profile layer. The sociogram feeds every generator — and every result shows what it satisfied and what it traded off, ready to override by hand.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Pill tone={savedFlash ? "green" : "plain"} style={{ fontSize: 11 }}>{savedFlash ? "Saved ✓" : "Autosaves locally"}</Pill>
              <button style={S.btnGhost} onClick={exportJSON}>Export JSON</button>
              <button style={S.btnGhost} onClick={() => jsonRef.current?.click()}>Import JSON</button>
              <input ref={jsonRef} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {VIEWS.map(([k, label]) => (<button key={k} onClick={() => { setView(k); if (["classes", "partners", "groups"].includes(k)) setResult(null); }} style={{ ...S.btnGhost, ...(view === k ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>{label}</button>))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 60px" }}>

        {/* ROSTER */}
        {view === "roster" && (
          <>
            <Section eyebrow="Pre-fill" title="Import a cohort"
              right={<>
                <button style={S.btnGhost} disabled={importBusy} onClick={() => fileRef.current?.click()}>{importBusy ? "Working…" : "Upload a file"}</button>
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; setImportBusy(true); setImportMsg("Reading file…"); try { await runImport(await extractSourceText(f)); } catch (err) { setImportMsg(`Import failed — ${err.message || err}`); setImportBusy(false); } }} />
                <button style={S.btn} disabled={importBusy || !importText.trim()} onClick={() => runImport(importText)}>{importBusy ? "Extracting…" : "Extract cohort"}</button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>Paste a class list with levels and notes, or upload a spreadsheet/PDF/photo — it fills profiles, needs and the pairing relationships. Then refine below.</div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"e.g.  Archie B (3–4): Reading L4, Writing L3, EAL. Friends with Milo, keep apart from Jack. Strength: verbal reasoning."} style={{ ...S.input, minHeight: 90, resize: "vertical" }} />
              {importMsg && <div style={{ marginTop: 8 }}><Pill tone={importMsg.startsWith("Import failed") ? "red" : "green"} style={{ fontSize: 11.5 }}>{importMsg}</Pill></div>}
            </Section>

            <Section eyebrow="Data foundation" title={`Student profiles (${students.length})`}
              right={<button style={S.btn} onClick={addStudent}>+ Add student</button>}>
              {students.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No students yet — import a cohort above or add one.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
                {students.map((s) => (
                  <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: "#FCFDFE" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <input value={s.name} onChange={(e) => upStudent(s.id, { name: e.target.value })} placeholder="Student name" style={{ ...S.input, fontWeight: 700, fontFamily: F.display }} />
                      <select value={s.centre} onChange={(e) => upStudent(s.id, { centre: e.target.value })} style={{ ...S.input, width: 130, fontSize: 11.5 }}>
                        {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.name.split(" ")[0]}</option>)}
                      </select>
                      <button onClick={() => delStudent(s.id)} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 14 }}>✕</button>
                    </div>
                    <Field label="Curriculum levels (VC2.0)" style={{ marginBottom: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {SUBJECTS.map((subj) => {
                          const lv = s.levels?.[subj];
                          const c = lv != null && lv !== "" ? levelColor(lv) : null;
                          return (
                            <div key={subj} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: T.sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subj}</span>
                              <input type="number" min={0} max={8} value={lv ?? ""} onChange={(e) => upStudent(s.id, { levels: { ...s.levels, [subj]: e.target.value === "" ? "" : Number(e.target.value) } })}
                                style={{ ...S.input, width: 54, padding: "5px 7px", fontSize: 12, ...(c ? { borderColor: c.line, background: c.soft, color: c.text, fontWeight: 700 } : {}) }} />
                            </div>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Learning needs" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {NEEDS.map((n) => <Chip key={n} on={(s.needs || []).includes(n)} onClick={() => upStudent(s.id, { needs: (s.needs || []).includes(n) ? s.needs.filter((x) => x !== n) : [...(s.needs || []), n] })}>{n}</Chip>)}
                      </div>
                    </Field>
                    <RelPicker label="Friends (sociogram — who they'd choose)" students={students} me={s} field="friends" onChange={(v) => upStudent(s.id, { friends: v })} />
                    <RelPicker label="Keep together" students={students} me={s} field="keepWith" onChange={(v) => upStudent(s.id, { keepWith: v })} color={{ soft: T.greenSoft, line: T.greenLine, text: T.green }} />
                    <RelPicker label="Keep apart" students={students} me={s} field="keepApart" onChange={(v) => upStudent(s.id, { keepApart: v })} color={{ soft: T.redSoft, line: T.redLine, text: T.red }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <Field label="Strengths" style={{ flex: 1 }}>
                        <input value={s.strengths || ""} onChange={(e) => upStudent(s.id, { strengths: e.target.value })} placeholder="e.g. leadership" style={{ ...S.input, fontSize: 12 }} />
                      </Field>
                      <Field label="Teacher rec." style={{ flex: 1 }}>
                        <input value={s.teacherRec || ""} onChange={(e) => upStudent(s.id, { teacherRec: e.target.value })} placeholder="e.g. with Ms Lee" style={{ ...S.input, fontSize: 12 }} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* SOCIOGRAM */}
        {view === "sociogram" && (
          <>
            <Section eyebrow="Shared data layer" title="Sociogram">
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>
                Reciprocated ties (both chose each other) are the strong signal every generator leans on. One-way ties and isolates are flagged so no student is left without a friendly link.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <Pill tone="green">{soc.stats.reduce((t, x) => t + x.recip, 0) / 2 | 0} reciprocated pairs</Pill>
                <Pill tone="amber">{soc.isolates.length} isolate{soc.isolates.length === 1 ? "" : "s"}</Pill>
                <Pill>{students.filter((s) => s.name).length} students mapped</Pill>
              </div>
              {soc.isolates.length > 0 && (
                <div style={{ borderRadius: 12, background: T.amberSoft, border: `1px solid ${T.amberLine}`, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: T.amber }}>
                  ◦ No reciprocated or inbound choices: {soc.isolates.map((id) => sName(id)).join(", ")} — worth a deliberate friendly link when grouping.
                </div>
              )}
              <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
                  <thead><tr>{["Student", "Chooses", "Chosen by", "Reciprocated with"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {students.filter((s) => s.name).map((s) => {
                      const st = soc.stats.find((x) => x.id === s.id);
                      const iso = soc.isolates.includes(s.id);
                      return (
                        <tr key={s.id} style={iso ? { background: T.amberSoft } : {}}>
                          <td style={{ ...tdStyle, fontWeight: 700, fontFamily: F.display }}>{s.name}{iso && <span style={{ color: T.amber, fontSize: 10.5, marginLeft: 6 }}>isolate</span>}</td>
                          <td style={tdStyle}>{st.out}</td>
                          <td style={tdStyle}>{st.inbound}</td>
                          <td style={tdStyle}>{st.recipIds.length ? st.recipIds.map((id) => sName(id)).join(", ") : <span style={{ color: T.faint }}>none</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* CLASS CREATOR */}
        {view === "classes" && (
          <>
            <Section eyebrow="Build classes" title="Class creator"
              right={<button style={S.btn} onClick={runClasses} disabled={students.filter((s) => s.name).length < 2}>Generate classes</button>}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="Number of classes"><input type="number" min={2} max={8} value={nClasses} onChange={(e) => setNClasses(Math.max(2, Number(e.target.value) || 2))} style={{ ...S.input, width: 90 }} /></Field>
                <Field label="Balance levels by subject"><select value={classSubject} onChange={(e) => setClassSubject(e.target.value)} style={{ ...S.input, width: 200 }}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Chip on={respectCentre} onClick={() => setRespectCentre(!respectCentre)}>Respect centre boundary</Chip>
              </div>
              <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Balances the chosen subject's levels across classes, keeps requested pairings together, enforces separations, and spreads learning needs. {respectCentre ? "Cross-centre pools only in Innovation & Leadership (Creativity stays single-class)." : "Centre boundary ignored — mixes across all centres."}</div>
            </Section>
            {result?.kind === "classes" && <ResultBoard result={result} students={students} moveStudent={moveStudent} dragFrom={dragFrom} setDragFrom={setDragFrom} sName={sName} subjectHint={result.meta.subject} />}
          </>
        )}

        {/* PARTNERS */}
        {view === "partners" && (
          <>
            <Section eyebrow="Compass partners" title="N / E / S / W allocations"
              right={<button style={S.btn} onClick={runPartners} disabled={students.filter((s) => s.name).length < 2}>Allocate partners</button>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>Every student gets four partners, each on a different rule. North & South use levels in the chosen subject; East uses the sociogram.</div>
              <Field label="Level subject (North = same, South = mixed)"><select value={partnerSubject} onChange={(e) => setPartnerSubject(e.target.value)} style={{ ...S.input, width: 220 }}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Pill tone="blue">N · same level in {partnerSubject}</Pill>
                <Pill tone="green">E · friends who work well</Pill>
                <Pill tone="amber">S · mixed level in {partnerSubject}</Pill>
                <Pill>W · a different mix</Pill>
              </div>
            </Section>
            {result?.kind === "partners" && (
              <Section eyebrow="Result" title="Partner rose per student" right={<button style={S.btnGhost} onClick={printCards}>Print partner cards</button>}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {students.filter((s) => s.name).map((s) => (
                    <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
                      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>{s.name}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {result.dirs.map((d) => {
                          const tone = { N: "blue", E: "green", S: "amber", W: "plain" }[d.dir];
                          return (
                            <div key={d.dir} style={{ border: `1px solid ${T.lineSoft}`, borderRadius: 10, padding: "8px 10px" }}>
                              <div style={{ ...S.eyebrow, fontSize: 9.5 }}>{d.label}</div>
                              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{sName(result.byStudent[s.id]?.[d.dir]) || "—"}</div>
                              <Pill tone={tone} style={{ fontSize: 9.5, marginTop: 4, padding: "3px 8px" }}>{d.desc}</Pill>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* GROUPS */}
        {view === "groups" && (
          <>
            <Section eyebrow="Activity & camp" title="Activity / cabin group creator"
              right={<button style={S.btn} onClick={runGroups} disabled={students.filter((s) => s.name).length < 2}>Generate groups</button>}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="Number of groups / cabins"><input type="number" min={2} max={12} value={nGroups} onChange={(e) => setNGroups(Math.max(2, Number(e.target.value) || 2))} style={{ ...S.input, width: 90 }} /></Field>
                <Field label="Social mix">
                  <div style={{ display: "flex", gap: 6 }}>
                    <Chip on={groupMode === "mixed"} onClick={() => setGroupMode("mixed")}>Break up cliques</Chip>
                    <Chip on={groupMode === "friend"} onClick={() => setGroupMode("friend")}>Keep friends together</Chip>
                  </div>
                </Field>
              </div>
              <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Honours keep-together and keep-apart, evens group sizes, and either scatters or preserves friend links depending on the mix.</div>
            </Section>
            {result?.kind === "groups" && <ResultBoard result={result} students={students} moveStudent={moveStudent} dragFrom={dragFrom} setDragFrom={setDragFrom} sName={sName} />}
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = { padding: "10px 12px", textAlign: "left", fontFamily: F.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint, borderBottom: `1px solid ${T.line}`, background: "#FAFBFD" };
const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5, verticalAlign: "top" };

/* ---------- relationship picker ---------- */
function RelPicker({ label, students, me, field, onChange, color }) {
  const sel = me[field] || [];
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {sel.map((id) => {
          const s = students.find((x) => x.id === id);
          return <Chip key={id} on color={color} onClick={() => onChange(sel.filter((x) => x !== id))}>{s?.name || "?"} ✕</Chip>;
        })}
        <button onClick={() => setOpen((o) => !o)} style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11, color: T.faint }}>{open ? "close" : "+ add"}</button>
      </div>
      {open && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, maxHeight: 120, overflowY: "auto", padding: 6, border: `1px solid ${T.lineSoft}`, borderRadius: 10 }}>
          {students.filter((s) => s.id !== me.id && s.name && !sel.includes(s.id)).map((s) => (
            <Chip key={s.id} on={false} onClick={() => { onChange([...sel, s.id]); }}>{s.name}</Chip>
          ))}
        </div>
      )}
    </Field>
  );
}

/* ---------- result board (classes / groups) with override + audit ---------- */
function ResultBoard({ result, students, moveStudent, dragFrom, setDragFrom, sName, subjectHint }) {
  const { groups, labels, audit } = result;
  return (
    <>
      <Section eyebrow="Constraint transparency" title="What this satisfied — and traded off">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ ...S.eyebrow, color: T.green, marginBottom: 6 }}>Satisfied ({audit.kept.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              {audit.kept.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>No explicit pairings to satisfy.</span>}
              {audit.kept.map((k, i) => <div key={i} style={{ fontSize: 12.5, color: T.green }}>✓ {k}</div>)}
            </div>
          </div>
          <div>
            <div style={{ ...S.eyebrow, color: T.red, marginBottom: 6 }}>Traded off ({audit.broke.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              {audit.broke.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>Nothing was broken — every constraint held.</span>}
              {audit.broke.map((k, i) => <div key={i} style={{ fontSize: 12.5, color: T.red }}>✕ {k}</div>)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {audit.notes.map((n, i) => <Pill key={i} style={{ fontSize: 11 }}>{n}</Pill>)}
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {groups.map((g, gi) => {
          const tint = GROUP_TINTS[gi % GROUP_TINTS.length];
          const main = GROUP_MAIN[gi % GROUP_MAIN.length];
          const avg = subjectHint ? avgLevel(g, subjectHint) : null;
          return (
            <div key={gi}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom) { moveStudent(dragFrom, gi); setDragFrom(null); } }}
              style={{ border: `1px solid ${T.line}`, borderTop: `4px solid ${main}`, borderRadius: 14, background: tint, padding: 12, minHeight: 120 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 14, color: main }}>{labels[gi]}</div>
                <span style={{ fontSize: 11, color: T.sub }}>{g.length}{avg != null && ` · avg ${avg.toFixed(1)}`}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {g.map((s) => (
                  <div key={s.id} draggable onDragStart={() => setDragFrom(s.id)}
                    style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 9px", fontSize: 12, cursor: "grab", display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ display: "inline-flex", gap: 3 }}>
                      {subjectHint && s.levels?.[subjectHint] != null && s.levels?.[subjectHint] !== "" && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: levelColor(s.levels[subjectHint]).text, background: levelColor(s.levels[subjectHint]).soft, border: `1px solid ${levelColor(s.levels[subjectHint]).line}`, borderRadius: 6, padding: "0 5px" }}>{s.levels[subjectHint]}</span>
                      )}
                      {(s.needs || []).slice(0, 2).map((n) => <span key={n} style={{ fontSize: 9.5, color: T.sub }}>{n}</span>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ color: T.faint, fontSize: 11.5, marginTop: 10 }}>Drag any student to another group to override — the audit re-balances instantly.</div>
    </>
  );
}
