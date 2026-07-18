import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   AIDE TIMETABLE — weekly aide support planner
   CPS · Timetables (B10) · standalone tool · Chunk & Check aesthetic

   · Aides work certain days — availability is per-day, per aide
   · Each student has an ideal number of 50-minute sessions/day
   · Sessions are preferable when the class timetable subject
     matches a student's priority subjects — suggestions surface
   · Aide ↔ student affinities ("works well with") weight the
     generator and the cell picker
   · Generate → LOCK what works → regenerate repairs the rest
     (locked cells are never touched)
   · Break periods (recess/lunch) are never auto-assigned;
     manual break cover is flagged so no aide loses both breaks
   · Day-to-day tab: student absences, aide absences and pop-ups
     overlay the base week without destroying it
   · Hours tab: planned vs adjusted support minutes per student,
     load per aide, CSV export
   · Import pre-information: paste text or upload a file
     (docx/xlsx/pdf/image) — aides, students and year-level
     class timetables are extracted and pre-fill the tool
   · Autosaves locally · JSON backup in/out
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
const F = {
  display: "'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
};
const S = {
  card: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, boxShadow: T.shadow, padding: 18 },
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint },
  pill: {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 14px",
    background: T.card, border: `1px solid ${T.line}`, boxShadow: "0 1px 2px rgba(15,23,42,.05)",
    fontFamily: F.body, fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap",
  },
  btn: {
    cursor: "pointer", border: "none", borderRadius: 999, padding: "9px 18px",
    background: T.blue, color: "#FFFFFF", fontFamily: F.body, fontSize: 13, fontWeight: 700,
    boxShadow: "0 1px 2px rgba(37,99,235,.35), 0 6px 16px rgba(37,99,235,.25)",
  },
  btnGhost: {
    cursor: "pointer", borderRadius: 999, padding: "8px 16px",
    background: T.card, color: T.ink, border: `1px solid ${T.line}`,
    fontFamily: F.body, fontSize: 12.5, fontWeight: 600, boxShadow: "0 1px 2px rgba(15,23,42,.05)",
  },
  input: {
    width: "100%", borderRadius: 12, border: `1px solid ${T.line}`, padding: "10px 12px",
    fontFamily: F.body, fontSize: 13.5, color: T.ink, background: T.card, outline: "none",
  },
  label: { fontFamily: F.body, fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 6, display: "block" },
};
const Pill = ({ children, tone = "plain", style = {} }) => {
  const tones = {
    plain: {},
    blue: { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep },
    amber: { background: T.amberSoft, borderColor: T.amberLine, color: T.amber },
    green: { background: T.greenSoft, borderColor: T.greenLine, color: T.green },
    red: { background: T.redSoft, borderColor: T.redLine, color: T.red },
    ink: { background: T.ink, borderColor: T.ink, color: "#FFFFFF" },
  };
  return <span style={{ ...S.pill, ...tones[tone], ...style }}>{children}</span>;
};
const Toggle = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{
    ...S.btnGhost, padding: "5px 12px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 6,
    ...(on ? { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep } : { color: T.sub }),
  }}>
    <span style={{
      width: 22, height: 13, borderRadius: 999, position: "relative", flex: "0 0 auto",
      background: on ? T.blue : "#CBD5E1", transition: "background .15s",
    }}>
      <span style={{ position: "absolute", top: 1.5, left: on ? 11 : 1.5, width: 10, height: 10, borderRadius: 999, background: "#FFF", transition: "left .15s" }} />
    </span>
    {children}
  </button>
);

/* aide colours — each aide wears one everywhere they appear */
const AIDE_COLORS = [
  { main: "#2563EB", text: "#1D4ED8", soft: "#EFF6FF", line: "#BFDBFE" }, // blue
  { main: "#7C3AED", text: "#6D28D9", soft: "#F5F3FF", line: "#DDD6FE" }, // violet
  { main: "#DB2777", text: "#BE185D", soft: "#FDF2F8", line: "#FBCFE8" }, // pink
  { main: "#EA580C", text: "#C2410C", soft: "#FFF7ED", line: "#FED7AA" }, // orange
  { main: "#0D9488", text: "#0F766E", soft: "#F0FDFA", line: "#99F6E4" }, // teal
  { main: "#16A34A", text: "#15803D", soft: "#F0FDF4", line: "#BBF7D0" }, // green
  { main: "#4F46E5", text: "#4338CA", soft: "#EEF2FF", line: "#C7D2FE" }, // indigo
  { main: "#CA8A04", text: "#A16207", soft: "#FEFCE8", line: "#FDE68A" }, // gold
];
const aideColor = (idx) => AIDE_COLORS[idx % AIDE_COLORS.length];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_PERIODS = [
  { id: "s1", label: "Session 1", start: "9:00", end: "9:50", type: "session" },
  { id: "s2", label: "Session 2", start: "9:50", end: "10:40", type: "session" },
  { id: "rec", label: "Recess", start: "10:40", end: "11:10", type: "break" },
  { id: "s3", label: "Session 3", start: "11:10", end: "12:00", type: "session" },
  { id: "s4", label: "Session 4", start: "12:00", end: "12:50", type: "session" },
  { id: "lun", label: "Lunch", start: "12:50", end: "13:40", type: "break" },
  { id: "s5", label: "Session 5", start: "13:40", end: "14:30", type: "session" },
  { id: "s6", label: "Session 6", start: "14:30", end: "15:20", type: "session" },
];
const SESSION_MIN = 50;
const STORAGE_KEY = "i3s-aide-timetable-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const ck = (day, pid) => `${day}|${pid}`;

/* ---------- Anthropic API helper (Chunk & Check pattern) ---------- */
async function askClaude(messages, maxTokens = 4000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
const parseJSON = (text) => JSON.parse(text.replace(/```json|```/g, "").trim());

/* ---------- context file extraction (txt/docx/xlsx direct · pdf/images via Claude) ---------- */
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = () => rej(new Error("Read failed"));
  r.readAsDataURL(file);
});
const fileToText = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(new Error("Read failed"));
  r.readAsText(file);
});
async function extractSourceText(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.split(".").pop();
  if (["txt", "md", "csv", "tsv"].includes(ext) || file.type.startsWith("text/")) return await fileToText(file);
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value || "";
  }
  if (["xlsx", "xls"].includes(ext)) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map((sn) => `--- Sheet: ${sn} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}`).join("\n\n");
  }
  if (ext === "pdf" || file.type === "application/pdf") {
    const b64 = await fileToBase64(file);
    return await askClaude([{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
      { type: "text", text: "Extract ALL the text from this document verbatim, preserving structure and any timetable grids. Output ONLY the extracted text." },
    ] }], 6000);
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || file.type.startsWith("image/")) {
    const media = file.type?.startsWith("image/") ? file.type : ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "image/png");
    const b64 = await fileToBase64(file);
    return await askClaude([{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: media, data: b64 } },
      { type: "text", text: "Transcribe ALL text visible in this image verbatim, preserving any timetable grid structure (label rows and columns). Output ONLY the transcription." },
    ] }], 6000);
  }
  throw new Error(`Can't read .${ext} — use .docx, .xlsx, .pdf, an image, or paste the text.`);
}

/* ---------- helpers ---------- */
const subjectFor = (student, day, pid, classes) => {
  const kl = classes.find((c) => c.id === student.classId);
  return (kl && kl.tt && kl.tt[day] && kl.tt[day][pid]) || "";
};
const subjMatches = (subj, prefs) =>
  !!subj && (prefs || []).some((p) => p && subj.toLowerCase().includes(p.toLowerCase()));

function scoreStudent(s, day, p, classes, dayCount, weekCount) {
  let sc = 0;
  const subj = subjectFor(s, day, p.id, classes);
  if (subjMatches(subj, s.prefSubjects)) sc += 4;
  sc += Math.max(0, (s.ideal || 0) - (dayCount[s.id] || 0));
  const idealWeek = (s.ideal || 0) * 5;
  sc += Math.max(0, idealWeek - (weekCount[s.id] || 0)) * 0.3;
  return sc;
}

/* generate → lock → repair: locked assignments are kept, everything else refilled */
function generateWeek({ periods, aides, students, classes, base }) {
  const sessions = periods.filter((p) => p.type === "session");
  const next = {};
  for (const key of Object.keys(base || {})) {
    const kept = (base[key] || []).filter((a) => a.locked);
    if (kept.length) next[key] = kept;
  }
  const weekCount = {};
  Object.values(next).flat().forEach((a) => { weekCount[a.studentId] = (weekCount[a.studentId] || 0) + 1; });

  for (const day of DAYS) {
    const dayCountS = {}, dayCountA = {};
    sessions.forEach((p) => (next[ck(day, p.id)] || []).forEach((a) => {
      dayCountS[a.studentId] = (dayCountS[a.studentId] || 0) + 1;
      dayCountA[a.aideId] = (dayCountA[a.aideId] || 0) + 1;
    }));
    for (const p of sessions) {
      const key = ck(day, p.id);
      const cell = next[key] ? [...next[key]] : [];
      const busyA = new Set(cell.map((a) => a.aideId));
      const busyS = new Set(cell.map((a) => a.studentId));
      const availAides = aides.filter((a) =>
        a.days[day] && !busyA.has(a.id) && (dayCountA[a.id] || 0) < (a.maxPerDay || 4));
      if (!availAides.length) { if (cell.length) next[key] = cell; continue; }
      const cands = students
        .filter((s) => s.active !== false && s.classId && !busyS.has(s.id) && (dayCountS[s.id] || 0) < (s.ideal || 0))
        .map((s) => ({ s, sc: scoreStudent(s, day, p, classes, dayCountS, weekCount) }))
        .sort((x, y) => y.sc - x.sc);
      for (const { s } of cands) {
        if (!availAides.length) break;
        let pick = availAides.find((a) => (s.prefAides || []).includes(a.id) || (a.worksWith || []).includes(s.id));
        if (!pick) pick = [...availAides].sort((a, b) => (dayCountA[a.id] || 0) - (dayCountA[b.id] || 0))[0];
        cell.push({ id: uid(), aideId: pick.id, studentId: s.id, locked: false });
        availAides.splice(availAides.indexOf(pick), 1);
        dayCountS[s.id] = (dayCountS[s.id] || 0) + 1;
        dayCountA[pick.id] = (dayCountA[pick.id] || 0) + 1;
        weekCount[s.id] = (weekCount[s.id] || 0) + 1;
      }
      if (cell.length) next[key] = cell;
    }
  }
  return next;
}

function findConflicts({ periods, aides, students, base }) {
  const out = [];
  const byId = (arr, id) => arr.find((x) => x.id === id);
  for (const day of DAYS) {
    const dayA = {}, dayS = {};
    for (const p of periods) {
      const cell = base[ck(day, p.id)] || [];
      const seenA = {}, seenS = {};
      for (const a of cell) {
        const aide = byId(aides, a.aideId), stu = byId(students, a.studentId);
        if (!aide || !stu) continue;
        if (seenA[a.aideId]) out.push({ level: "hard", text: `${day} ${p.label}: ${aide.name} is double-booked` });
        if (seenS[a.studentId]) out.push({ level: "hard", text: `${day} ${p.label}: ${stu.name} has two aides at once` });
        seenA[a.aideId] = true; seenS[a.studentId] = true;
        if (!aide.days[day]) out.push({ level: "hard", text: `${day} ${p.label}: ${aide.name} doesn't work ${day}s` });
        if (p.type === "session") {
          dayA[a.aideId] = (dayA[a.aideId] || 0) + 1;
          dayS[a.studentId] = (dayS[a.studentId] || 0) + 1;
        }
      }
    }
    for (const aid of Object.keys(dayA)) {
      const aide = byId(aides, aid);
      if (aide && dayA[aid] > (aide.maxPerDay || 4))
        out.push({ level: "soft", text: `${day}: ${aide.name} has ${dayA[aid]} sessions (cap ${aide.maxPerDay || 4})` });
    }
    for (const sid of Object.keys(dayS)) {
      const stu = byId(students, sid);
      if (stu && dayS[sid] > (stu.ideal || 0))
        out.push({ level: "soft", text: `${day}: ${stu.name} has ${dayS[sid]} sessions (ideal ${stu.ideal})` });
    }
    // break protection — an aide manually covering both breaks gets no break at all
    const breaks = periods.filter((p) => p.type === "break");
    for (const aide of aides) {
      if (!aide.days[day]) continue;
      const covered = breaks.filter((p) => (base[ck(day, p.id)] || []).some((a) => a.aideId === aide.id));
      if (breaks.length > 0 && covered.length === breaks.length)
        out.push({ level: "soft", text: `${day}: ${aide.name} is covering every break — no break left` });
    }
  }
  return out;
}

/* apply a day's overrides to the base week → effective schedule for that day */
function dayEffective(base, periods, day, ov) {
  const o = ov || { absS: [], absA: [], added: [], removed: [] };
  const out = {};
  for (const p of periods) {
    const key = ck(day, p.id);
    let cell = (base[key] || []).filter((a) => !o.removed.includes(a.id));
    cell = cell.concat((o.added || []).filter((a) => a.periodId === p.id));
    out[p.id] = cell.map((a) => ({
      ...a,
      studentAbsent: o.absS.includes(a.studentId),
      aideAbsent: o.absA.includes(a.aideId),
    }));
  }
  return out;
}

/* ---------- small shared UI bits ---------- */
const Field = ({ label, children, style = {} }) => (
  <div style={{ ...style }}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
);
const Chip = ({ on, onClick, children, color }) => (
  <button onClick={onClick} style={{
    ...S.btnGhost, padding: "4px 11px", fontSize: 11.5,
    ...(on
      ? (color
        ? { background: color.soft, borderColor: color.line, color: color.text }
        : { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep })
      : { color: T.faint }),
  }}>{children}</button>
);
const Section = ({ eyebrow, title, right, children }) => (
  <div style={{ ...S.card, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      <div>
        <div style={S.eyebrow}>{eyebrow}</div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{title}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>
    </div>
    {children}
  </div>
);

/* ============================================================ */
export default function App() {
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [aides, setAides] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [base, setBase] = useState({});
  const [overrides, setOverrides] = useState({});
  const [view, setView] = useState("setup");
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef(null);
  const jsonRef = useRef(null);

  /* ---- persistence ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.periods) setPeriods(d.periods);
        if (d.aides) setAides(d.aides);
        if (d.students) setStudents(d.students);
        if (d.classes) setClasses(d.classes);
        if (d.base) setBase(d.base);
        if (d.overrides) setOverrides(d.overrides);
      }
    } catch (e) { /* fresh start */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ periods, aides, students, classes, base, overrides }));
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 900);
      return () => clearTimeout(t);
    } catch (e) { /* storage full */ }
  }, [periods, aides, students, classes, base, overrides, loaded]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ periods, aides, students, classes, base, overrides }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aide-timetable.json";
    a.click();
  };
  const importJSON = async (file) => {
    try {
      const d = JSON.parse(await fileToText(file));
      if (d.periods) setPeriods(d.periods);
      setAides(d.aides || []); setStudents(d.students || []);
      setClasses(d.classes || []); setBase(d.base || {}); setOverrides(d.overrides || {});
    } catch (e) { alert("Couldn't read that JSON file."); }
  };

  /* ---- entity edits ---- */
  const upAide = (id, patch) => setAides((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const upStudent = (id, patch) => setStudents((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const upClass = (id, patch) => setClasses((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addAide = () => setAides((xs) => [...xs, {
    id: uid(), name: "", colorIdx: xs.length, maxPerDay: 4, notes: "",
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true }, worksWith: [],
  }]);
  const addStudent = () => setStudents((xs) => [...xs, {
    id: uid(), name: "", classId: classes[0]?.id || "", ideal: 2,
    prefSubjects: [], prefAides: [], notes: "", active: true,
  }]);
  const addClass = () => setClasses((xs) => [...xs, { id: uid(), name: "", tt: {} }]);
  const delAide = (id) => {
    setAides((xs) => xs.filter((x) => x.id !== id));
    setBase((b) => { const n = {}; for (const k of Object.keys(b)) { const c = b[k].filter((a) => a.aideId !== id); if (c.length) n[k] = c; } return n; });
  };
  const delStudent = (id) => {
    setStudents((xs) => xs.filter((x) => x.id !== id));
    setBase((b) => { const n = {}; for (const k of Object.keys(b)) { const c = b[k].filter((a) => a.studentId !== id); if (c.length) n[k] = c; } return n; });
  };
  const delClass = (id) => {
    setClasses((xs) => xs.filter((x) => x.id !== id));
    setStudents((xs) => xs.map((s) => (s.classId === id ? { ...s, classId: "" } : s)));
  };

  const aName = (id) => aides.find((a) => a.id === id)?.name || "?";
  const sName = (id) => students.find((s) => s.id === id)?.name || "?";
  const aColor = (id) => aideColor(aides.find((a) => a.id === id)?.colorIdx ?? 0);

  const conflicts = findConflicts({ periods, aides, students, base });
  const sessions = periods.filter((p) => p.type === "session");

  /* ---- AI pre-information import ---- */
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  async function runImport(sourceText) {
    setImportBusy(true); setImportMsg("Reading and extracting…");
    try {
      const sessionLabels = sessions.map((p) => `${p.label} (${p.start}–${p.end})`).join(", ");
      const prompt = `You are pre-filling a weekly teacher-aide timetable tool for a Victorian primary school.
The school day has these teaching sessions in order: ${sessionLabels}. Days are Mon–Fri.

From the source below, extract whatever is present into this exact JSON shape (omit arrays you find nothing for):
{
 "aides":[{"name":"","days":["Mon","Tue","Wed","Thu","Fri"],"worksWellWith":["student name"],"maxSessionsPerDay":4,"notes":""}],
 "students":[{"name":"","className":"","idealSessionsPerDay":2,"prioritySubjects":["Writing"],"preferredAides":["aide name"],"notes":""}],
 "classes":[{"name":"","timetable":{"Mon":["subject for session 1","subject for session 2","...one per teaching session in order"]}}]
}
Rules: class timetables list ONLY teaching-session subjects (skip recess/lunch rows), one entry per session in order, "" where unknown. Use the names exactly as written. Output ONLY the JSON.

SOURCE:
${sourceText}`;
      const raw = await askClaude([{ role: "user", content: prompt }], 6000);
      const data = parseJSON(raw);

      // classes first so students can link to them
      const newClasses = [...classes];
      for (const c of data.classes || []) {
        if (!c.name) continue;
        let kl = newClasses.find((k) => k.name.toLowerCase() === c.name.toLowerCase());
        if (!kl) { kl = { id: uid(), name: c.name, tt: {} }; newClasses.push(kl); }
        const tt = { ...(kl.tt || {}) };
        for (const day of DAYS) {
          const row = (c.timetable || {})[day];
          if (!row) continue;
          tt[day] = { ...(tt[day] || {}) };
          sessions.forEach((p, i) => { if (row[i]) tt[day][p.id] = row[i]; });
        }
        kl.tt = tt;
      }

      const newAides = [...aides];
      for (const a of data.aides || []) {
        if (!a.name) continue;
        let ad = newAides.find((x) => x.name.toLowerCase() === a.name.toLowerCase());
        if (!ad) {
          ad = { id: uid(), name: a.name, colorIdx: newAides.length, maxPerDay: a.maxSessionsPerDay || 4, notes: a.notes || "", days: {}, worksWith: [] };
          DAYS.forEach((d) => { ad.days[d] = a.days ? a.days.includes(d) : true; });
          newAides.push(ad);
        } else if (a.days) {
          DAYS.forEach((d) => { ad.days[d] = a.days.includes(d); });
        }
        ad._wantsStudents = a.worksWellWith || [];
      }

      const newStudents = [...students];
      for (const s of data.students || []) {
        if (!s.name) continue;
        let st = newStudents.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
        const kl = newClasses.find((k) => k.name.toLowerCase() === (s.className || "").toLowerCase());
        if (!st) {
          st = { id: uid(), name: s.name, classId: kl?.id || "", ideal: s.idealSessionsPerDay ?? 2, prefSubjects: s.prioritySubjects || [], prefAides: [], notes: s.notes || "", active: true };
          newStudents.push(st);
        } else {
          if (kl) st.classId = kl.id;
          if (s.idealSessionsPerDay != null) st.ideal = s.idealSessionsPerDay;
          if (s.prioritySubjects?.length) st.prefSubjects = s.prioritySubjects;
        }
        st._wantsAides = s.preferredAides || [];
      }

      // resolve name-based cross links
      for (const ad of newAides) {
        if (ad._wantsStudents) {
          ad.worksWith = Array.from(new Set([...(ad.worksWith || []),
            ...ad._wantsStudents.map((n) => newStudents.find((s) => s.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean)]));
          delete ad._wantsStudents;
        }
      }
      for (const st of newStudents) {
        if (st._wantsAides) {
          st.prefAides = Array.from(new Set([...(st.prefAides || []),
            ...st._wantsAides.map((n) => newAides.find((a) => a.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean)]));
          delete st._wantsAides;
        }
      }

      setClasses(newClasses); setAides(newAides); setStudents(newStudents);
      setImportMsg(`Imported: ${(data.aides || []).length} aides · ${(data.students || []).length} students · ${(data.classes || []).length} class timetables.`);
      setImportText("");
    } catch (e) {
      setImportMsg(`Import failed — ${e.message || e}`);
    }
    setImportBusy(false);
  }

  /* ---- class timetable paste parsing ---- */
  function pasteClassTT(klId, text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const split = (l) => l.split(/\t|,| {2,}/).map((x) => x.trim());
    let rows = lines.map(split);
    // drop a header row that names the days
    if (rows[0].some((c) => DAYS.some((d) => c.toLowerCase().startsWith(d.toLowerCase())))) rows = rows.slice(1);
    // drop a leading label column if the first cell isn't a subject-shaped word (e.g. "Session 1", "9:00")
    const hasLabelCol = rows.every((r) => /session|^\d|recess|lunch/i.test(r[0] || ""));
    const tt = {};
    rows = rows.filter((r) => !/recess|lunch/i.test(r[0] || ""));
    rows.forEach((r, i) => {
      const cells = hasLabelCol ? r.slice(1) : r;
      const p = sessions[i];
      if (!p) return;
      DAYS.forEach((d, di) => {
        if (cells[di]) { tt[d] = tt[d] || {}; tt[d][p.id] = cells[di]; }
      });
    });
    const kl = classes.find((k) => k.id === klId);
    upClass(klId, { tt: { ...(kl?.tt || {}), ...mergeTT(kl?.tt || {}, tt) } });
  }
  const mergeTT = (a, b) => {
    const out = { ...a };
    for (const d of Object.keys(b)) out[d] = { ...(out[d] || {}), ...b[d] };
    return out;
  };
  const [classFileBusy, setClassFileBusy] = useState("");
  async function importClassFile(klId, file) {
    setClassFileBusy(klId);
    try {
      const text = await extractSourceText(file);
      const sessionLabels = sessions.map((p, i) => `${i + 1}. ${p.label} (${p.start}–${p.end})`).join("  ");
      const raw = await askClaude([{ role: "user", content:
`This is a primary-school class weekly timetable. Our teaching sessions in order are: ${sessionLabels}. Days Mon–Fri.
Map the timetable onto those sessions and output ONLY JSON:
{"Mon":["subject for session 1", "...one per teaching session"],"Tue":[...],"Wed":[...],"Thu":[...],"Fri":[...]}
Use "" where a session has no clear subject. Skip recess/lunch rows.

TIMETABLE:
${text}` }], 4000);
      const grid = parseJSON(raw);
      const tt = {};
      for (const d of DAYS) {
        if (!grid[d]) continue;
        tt[d] = {};
        sessions.forEach((p, i) => { if (grid[d][i]) tt[d][p.id] = grid[d][i]; });
      }
      const kl = classes.find((k) => k.id === klId);
      upClass(klId, { tt: mergeTT(kl?.tt || {}, tt) });
    } catch (e) { alert(`Couldn't import that timetable — ${e.message || e}`); }
    setClassFileBusy("");
  }

  /* ---- build tab: cell picker ---- */
  const [picker, setPicker] = useState(null); // {day, pid}
  function cellSuggestions(day, p) {
    const key = ck(day, p.id);
    const cell = base[key] || [];
    const busyA = new Set(cell.map((a) => a.aideId));
    const busyS = new Set(cell.map((a) => a.studentId));
    const dayCountS = {}, dayCountA = {}, weekCount = {};
    sessions.forEach((sp) => DAYS.forEach((d) => (base[ck(d, sp.id)] || []).forEach((a) => {
      weekCount[a.studentId] = (weekCount[a.studentId] || 0) + 1;
      if (d === day) { dayCountS[a.studentId] = (dayCountS[a.studentId] || 0) + 1; dayCountA[a.aideId] = (dayCountA[a.aideId] || 0) + 1; }
    })));
    const stu = students
      .filter((s) => s.active !== false && !busyS.has(s.id))
      .map((s) => ({ s, sc: scoreStudent(s, day, p, classes, dayCountS, weekCount), subj: subjectFor(s, day, p.id, classes) }))
      .sort((x, y) => y.sc - x.sc);
    const aid = aides.filter((a) => a.days[day] && !busyA.has(a.id))
      .map((a) => ({ a, load: dayCountA[a.id] || 0 }))
      .sort((x, y) => x.load - y.load);
    return { stu, aid };
  }
  function addAssignment(day, pid, aideId, studentId) {
    const key = ck(day, pid);
    setBase((b) => ({ ...b, [key]: [...(b[key] || []), { id: uid(), aideId, studentId, locked: true }] }));
  }
  const toggleLock = (day, pid, id) => setBase((b) => ({
    ...b, [ck(day, pid)]: (b[ck(day, pid)] || []).map((a) => (a.id === id ? { ...a, locked: !a.locked } : a)),
  }));
  const removeAssignment = (day, pid, id) => setBase((b) => {
    const cell = (b[ck(day, pid)] || []).filter((a) => a.id !== id);
    const n = { ...b };
    if (cell.length) n[ck(day, pid)] = cell; else delete n[ck(day, pid)];
    return n;
  });

  /* ---- day-to-day ---- */
  const [dayView, setDayView] = useState("Mon");
  const ov = overrides[dayView] || { absS: [], absA: [], added: [], removed: [] };
  const setOv = (patch) => setOverrides((o) => ({ ...o, [dayView]: { ...ov, ...patch } }));
  const eff = dayEffective(base, periods, dayView, ov);
  const [reassign, setReassign] = useState(null); // {periodId, forStudentId? , forAideId?}

  function dayIssues() {
    const issues = [];
    for (const p of sessions) {
      for (const a of eff[p.id] || []) {
        if (a.aideAbsent && !a.studentAbsent)
          issues.push({ type: "uncovered", periodId: p.id, period: p, a });
        if (a.studentAbsent && !a.aideAbsent)
          issues.push({ type: "freed", periodId: p.id, period: p, a });
      }
    }
    return issues;
  }
  function freeAidesAt(pid) {
    const busy = new Set((eff[pid] || []).filter((x) => !x.aideAbsent && !x.studentAbsent).map((x) => x.aideId));
    return aides.filter((a) => a.days[dayView] && !ov.absA.includes(a.id) && !busy.has(a.id));
  }
  function needyStudentsAt(pid) {
    const busy = new Set((eff[pid] || []).filter((x) => !x.studentAbsent && !x.aideAbsent).map((x) => x.studentId));
    const dayCount = {};
    sessions.forEach((sp) => (eff[sp.id] || []).forEach((x) => {
      if (!x.studentAbsent && !x.aideAbsent) dayCount[x.studentId] = (dayCount[x.studentId] || 0) + 1;
    }));
    return students
      .filter((s) => s.active !== false && !ov.absS.includes(s.id) && !busy.has(s.id))
      .map((s) => ({ s, deficit: (s.ideal || 0) - (dayCount[s.id] || 0), subj: subjectFor(s, dayView, pid, classes) }))
      .sort((x, y) => y.deficit - x.deficit);
  }

  /* ---- hours ---- */
  function hoursData() {
    const planned = {}, adjusted = {};
    for (const d of DAYS) {
      const o = overrides[d] || { absS: [], absA: [], added: [], removed: [] };
      for (const p of sessions) {
        for (const a of base[ck(d, p.id)] || []) {
          planned[a.studentId] = (planned[a.studentId] || 0) + 1;
          if (!o.removed.includes(a.id) && !o.absS.includes(a.studentId) && !o.absA.includes(a.aideId))
            adjusted[a.studentId] = (adjusted[a.studentId] || 0) + 1;
        }
        for (const a of (o.added || []).filter((x) => x.periodId === p.id)) {
          if (!o.absS.includes(a.studentId) && !o.absA.includes(a.aideId))
            adjusted[a.studentId] = (adjusted[a.studentId] || 0) + 1;
        }
      }
    }
    const aideLoad = {};
    for (const d of DAYS) for (const p of sessions) for (const a of base[ck(d, p.id)] || [])
      aideLoad[a.aideId] = (aideLoad[a.aideId] || 0) + 1;
    return { planned, adjusted, aideLoad };
  }
  function exportHoursCSV() {
    const { planned, adjusted } = hoursData();
    const rows = [["Student", "Class", "Ideal sessions/wk", "Planned sessions", "Planned mins", "Adjusted sessions", "Adjusted mins"]];
    for (const s of students) {
      const kl = classes.find((c) => c.id === s.classId);
      rows.push([s.name, kl?.name || "", (s.ideal || 0) * 5, planned[s.id] || 0, (planned[s.id] || 0) * SESSION_MIN, adjusted[s.id] || 0, (adjusted[s.id] || 0) * SESSION_MIN]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "aide-support-hours.csv";
    a.click();
  }

  /* ============================================================ render */
  const VIEWS = [
    ["setup", "Aides & Students"],
    ["classes", "Class Timetables"],
    ["build", "Build the Week"],
    ["day", "Day-to-Day"],
    ["hours", "Support Hours"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: F.body, color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { border-color: ${T.blueLine} !important; box-shadow: 0 0 0 3px ${T.blueSoft}; }
        button:hover { filter: brightness(.985); }
      `}</style>

      {/* header */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={S.eyebrow}>CPS · Timetables · Standalone Tool</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", margin: "12px 0 6px" }}>
                Aide Timetable
              </h1>
              <div style={{ color: T.sub, fontSize: 13.5, maxWidth: 640 }}>
                Plan weekly aide support around each student's ideal sessions, the subjects that matter, and who works well with whom — then run day-to-day changes without losing the plan.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Pill tone={savedFlash ? "green" : "plain"} style={{ fontSize: 11 }}>{savedFlash ? "Saved ✓" : "Autosaves locally"}</Pill>
              <button style={S.btnGhost} onClick={exportJSON}>Export JSON</button>
              <button style={S.btnGhost} onClick={() => jsonRef.current?.click()}>Import JSON</button>
              <input ref={jsonRef} type="file" accept=".json" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {VIEWS.map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                style={{ ...S.btnGhost, ...(view === k ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 60px" }}>

        {/* ================= SETUP ================= */}
        {view === "setup" && (
          <>
            <Section eyebrow="Pre-fill" title="Import pre-information"
              right={<>
                <button style={S.btnGhost} disabled={importBusy} onClick={() => fileRef.current?.click()}>
                  {importBusy ? "Working…" : "Upload a file"}
                </button>
                <input ref={fileRef} type="file" style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files[0]; e.target.value = "";
                    if (!f) return;
                    setImportBusy(true); setImportMsg("Reading file…");
                    try { const text = await extractSourceText(f); await runImport(text); }
                    catch (err) { setImportMsg(`Import failed — ${err.message || err}`); setImportBusy(false); }
                  }} />
                <button style={S.btn} disabled={importBusy || !importText.trim()} onClick={() => runImport(importText)}>
                  {importBusy ? "Extracting…" : "Extract & pre-fill"}
                </button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>
                Paste anything you already have — an aide roster, student support notes, last term's plan, a year-level timetable — and it pre-fills aides, students and class timetables. Or upload a .docx / .xlsx / .pdf / image.
              </div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder={"e.g.  Sandra works Mon–Wed, great with Archie B.\nArchie B (3A) needs 3 sessions a day, mainly Writing and Reading…"}
                style={{ ...S.input, minHeight: 90, resize: "vertical", fontFamily: F.body }} />
              {importMsg && <div style={{ marginTop: 8 }}><Pill tone={importMsg.startsWith("Import failed") ? "red" : "green"} style={{ fontSize: 11.5 }}>{importMsg}</Pill></div>}
            </Section>

            <Section eyebrow="Who's supporting" title="Aides"
              right={<button style={S.btn} onClick={addAide}>+ Add aide</button>}>
              {aides.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No aides yet — add one, or import pre-information above.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {aides.map((a) => {
                  const c = aideColor(a.colorIdx);
                  return (
                    <div key={a.id} style={{ border: `1px solid ${T.line}`, borderLeft: `4px solid ${c.main}`, borderRadius: 14, padding: 14, background: "#FCFDFE" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input value={a.name} onChange={(e) => upAide(a.id, { name: e.target.value })}
                          placeholder="Aide name" style={{ ...S.input, fontWeight: 700, fontFamily: F.display }} />
                        <button title="Remove aide" onClick={() => delAide(a.id)}
                          style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 14 }}>✕</button>
                      </div>
                      <Field label="Works these days" style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {DAYS.map((d) => (
                            <Chip key={d} color={c} on={!!a.days[d]}
                              onClick={() => upAide(a.id, { days: { ...a.days, [d]: !a.days[d] } })}>{d}</Chip>
                          ))}
                        </div>
                      </Field>
                      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-end" }}>
                        <Field label="Max support sessions / day" style={{ flex: "0 0 170px" }}>
                          <input type="number" min={1} max={sessions.length} value={a.maxPerDay || 4}
                            onChange={(e) => upAide(a.id, { maxPerDay: Math.max(1, Number(e.target.value) || 1) })}
                            style={{ ...S.input, width: 90 }} />
                        </Field>
                        <div style={{ color: T.faint, fontSize: 11.5, paddingBottom: 10 }}>
                          leaves room for prep, breaks and pop-ups
                        </div>
                      </div>
                      <Field label="Works well with" style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {students.length === 0 && <span style={{ color: T.faint, fontSize: 12 }}>add students first</span>}
                          {students.map((s) => (
                            <Chip key={s.id} color={c} on={(a.worksWith || []).includes(s.id)}
                              onClick={() => upAide(a.id, {
                                worksWith: (a.worksWith || []).includes(s.id)
                                  ? a.worksWith.filter((x) => x !== s.id)
                                  : [...(a.worksWith || []), s.id],
                              })}>{s.name || "?"}</Chip>
                          ))}
                        </div>
                      </Field>
                      <Field label="Notes (breaks, duties, constraints)">
                        <input value={a.notes || ""} onChange={(e) => upAide(a.id, { notes: e.target.value })}
                          placeholder="e.g. leaves 2:30 on Fridays" style={S.input} />
                      </Field>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section eyebrow="Who's supported" title="Students"
              right={<button style={S.btn} onClick={addStudent}>+ Add student</button>}>
              {students.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No students yet.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {students.map((s) => (
                  <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: s.active === false ? "#F8FAFC" : "#FCFDFE", opacity: s.active === false ? 0.65 : 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <input value={s.name} onChange={(e) => upStudent(s.id, { name: e.target.value })}
                        placeholder="Student name" style={{ ...S.input, fontWeight: 700, fontFamily: F.display }} />
                      <Toggle on={s.active !== false} onClick={() => upStudent(s.id, { active: s.active === false })}>active</Toggle>
                      <button title="Remove student" onClick={() => delStudent(s.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 14 }}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <Field label="Class" style={{ flex: 1 }}>
                        <select value={s.classId} onChange={(e) => upStudent(s.id, { classId: e.target.value })} style={S.input}>
                          <option value="">— no class —</option>
                          {classes.map((k) => <option key={k.id} value={k.id}>{k.name || "unnamed class"}</option>)}
                        </select>
                      </Field>
                      <Field label="Ideal 50-min sessions / day" style={{ flex: "0 0 190px" }}>
                        <input type="number" min={0} max={sessions.length} value={s.ideal}
                          onChange={(e) => upStudent(s.id, { ideal: Math.max(0, Number(e.target.value) || 0) })}
                          style={{ ...S.input, width: 90 }} />
                      </Field>
                    </div>
                    <Field label="Priority subjects / events for support" style={{ marginBottom: 10 }}>
                      <SubjectChips student={s} classes={classes} onChange={(prefSubjects) => upStudent(s.id, { prefSubjects })} />
                    </Field>
                    <Field label="Preferred aides" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {aides.length === 0 && <span style={{ color: T.faint, fontSize: 12 }}>add aides first</span>}
                        {aides.map((a) => (
                          <Chip key={a.id} color={aideColor(a.colorIdx)} on={(s.prefAides || []).includes(a.id)}
                            onClick={() => upStudent(s.id, {
                              prefAides: (s.prefAides || []).includes(a.id)
                                ? s.prefAides.filter((x) => x !== a.id)
                                : [...(s.prefAides || []), a.id],
                            })}>{a.name || "?"}</Chip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Notes">
                      <input value={s.notes || ""} onChange={(e) => upStudent(s.id, { notes: e.target.value })}
                        placeholder="e.g. sensory break after lunch" style={S.input} />
                    </Field>
                  </div>
                ))}
              </div>
            </Section>

            <Section eyebrow="Day structure" title="Sessions & breaks">
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>
                The default CPS day: six 50-minute sessions with recess and lunch. Edit labels and times to match your campus — breaks are never auto-assigned.
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {periods.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={p.label}
                      onChange={(e) => setPeriods((ps) => ps.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))}
                      style={{ ...S.input, width: 160, ...(p.type === "break" ? { background: T.amberSoft } : {}) }} />
                    <input value={p.start}
                      onChange={(e) => setPeriods((ps) => ps.map((x, xi) => (xi === i ? { ...x, start: e.target.value } : x)))}
                      style={{ ...S.input, width: 80 }} />
                    <span style={{ color: T.faint }}>–</span>
                    <input value={p.end}
                      onChange={(e) => setPeriods((ps) => ps.map((x, xi) => (xi === i ? { ...x, end: e.target.value } : x)))}
                      style={{ ...S.input, width: 80 }} />
                    <Pill tone={p.type === "break" ? "amber" : "blue"} style={{ fontSize: 10.5 }}>{p.type}</Pill>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ================= CLASSES ================= */}
        {view === "classes" && (
          <>
            <Section eyebrow="Year-level schedules" title="Class timetables"
              right={<button style={S.btn} onClick={addClass}>+ Add class</button>}>
              <div style={{ color: T.sub, fontSize: 12.5 }}>
                Upload or paste each class's weekly timetable so the tool knows what every student's class is doing in any session — that's what powers "support them in Writing" suggestions.
              </div>
            </Section>
            {classes.length === 0 && (
              <div style={{ ...S.card, color: T.faint, fontSize: 13 }}>No classes yet — add one above.</div>
            )}
            {classes.map((k) => (
              <Section key={k.id} eyebrow="Class" title={
                <input value={k.name} onChange={(e) => upClass(k.id, { name: e.target.value })}
                  placeholder="e.g. 3A" style={{ ...S.input, width: 160, fontFamily: F.display, fontWeight: 700 }} />
              }
                right={<>
                  <label style={{ ...S.btnGhost, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    {classFileBusy === k.id ? "Importing…" : "Upload timetable"}
                    <input type="file" style={{ display: "none" }}
                      onChange={(e) => { if (e.target.files[0]) importClassFile(k.id, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <button style={{ ...S.btnGhost, color: T.red }} onClick={() => delClass(k.id)}>Remove</button>
                </>}>
                <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card, marginBottom: 10 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Session</th>
                        {DAYS.map((d) => <th key={d} style={thStyle}>{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p.id}>
                          <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: p.type === "break" ? T.amberSoft : "#FAFBFD" }}>
                            {p.label}<div style={{ color: T.faint, fontWeight: 500, fontSize: 10.5 }}>{p.start}–{p.end}</div>
                          </td>
                          {DAYS.map((d) => (
                            <td key={d} style={{ ...tdStyle, background: p.type === "break" ? T.amberSoft : undefined }}>
                              {p.type === "session" ? (
                                <input value={(k.tt?.[d]?.[p.id]) || ""}
                                  onChange={(e) => {
                                    const tt = { ...(k.tt || {}) };
                                    tt[d] = { ...(tt[d] || {}), [p.id]: e.target.value };
                                    upClass(k.id, { tt });
                                  }}
                                  placeholder="—" style={{ ...S.input, padding: "6px 8px", fontSize: 12, borderColor: T.lineSoft }} />
                              ) : <span style={{ color: T.amber, fontSize: 11.5, fontWeight: 600 }}>{p.label}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: T.blueDeep, fontWeight: 600 }}>Paste a grid instead</summary>
                  <PasteBox onPaste={(text) => pasteClassTT(k.id, text)} />
                </details>
              </Section>
            ))}
          </>
        )}

        {/* ================= BUILD ================= */}
        {view === "build" && (
          <>
            <Section eyebrow="Generate · lock · repair" title="The base week"
              right={<>
                <button style={S.btnGhost} onClick={() => {
                  if (confirm("Clear all unlocked assignments?")) {
                    setBase((b) => {
                      const n = {};
                      for (const key of Object.keys(b)) {
                        const kept = b[key].filter((a) => a.locked);
                        if (kept.length) n[key] = kept;
                      }
                      return n;
                    });
                  }
                }}>Clear unlocked</button>
                <button style={S.btn} onClick={() => setBase(generateWeek({ periods, aides, students, classes, base }))}>
                  Generate week
                </button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5 }}>
                Generate fills every unlocked cell from availability, ideal sessions, subject matches and affinities. Lock (🔒) anything you want kept, then regenerate — locked cells are never touched. Manual adds are locked automatically.
              </div>
              {conflicts.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{
                      borderRadius: 10, padding: "7px 12px", fontSize: 12.5,
                      background: c.level === "hard" ? T.redSoft : T.amberSoft,
                      border: `1px solid ${c.level === "hard" ? T.redLine : T.amberLine}`,
                      color: c.level === "hard" ? T.red : T.amber,
                    }}>{c.level === "hard" ? "⚠ " : "◦ "}{c.text}</div>
                  ))}
                </div>
              )}
            </Section>

            <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Session</th>
                    {DAYS.map((d) => <th key={d} style={thStyle}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: p.type === "break" ? T.amberSoft : "#FAFBFD", verticalAlign: "top" }}>
                        {p.label}<div style={{ color: T.faint, fontWeight: 500, fontSize: 10.5 }}>{p.start}–{p.end}</div>
                      </td>
                      {DAYS.map((d) => {
                        const cell = base[ck(d, p.id)] || [];
                        return (
                          <td key={d} style={{ ...tdStyle, verticalAlign: "top", background: p.type === "break" ? "#FFFDF4" : undefined, minWidth: 150 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {cell.map((a) => {
                                const c = aColor(a.aideId);
                                const subj = subjectFor(students.find((s) => s.id === a.studentId) || {}, d, p.id, classes);
                                return (
                                  <div key={a.id} style={{
                                    borderRadius: 10, padding: "6px 8px", fontSize: 11.5, lineHeight: 1.35,
                                    background: c.soft, border: `1px solid ${c.line}`, borderLeft: `3px solid ${c.main}`,
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                      <span style={{ fontWeight: 700, color: c.text }}>{aName(a.aideId)}</span>
                                      <span style={{ display: "inline-flex", gap: 4 }}>
                                        <button title={a.locked ? "Unlock" : "Lock"} onClick={() => toggleLock(d, p.id, a.id)}
                                          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, padding: 0, opacity: a.locked ? 1 : 0.35 }}>🔒</button>
                                        <button title="Remove" onClick={() => removeAssignment(d, p.id, a.id)}
                                          style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 11, padding: 0 }}>✕</button>
                                      </span>
                                    </div>
                                    <div>→ {sName(a.studentId)}</div>
                                    {subj && <div style={{ color: T.faint, fontSize: 10.5 }}>{subj}</div>}
                                  </div>
                                );
                              })}
                              <button onClick={() => setPicker({ day: d, pid: p.id })}
                                style={{ ...S.btnGhost, padding: "3px 8px", fontSize: 10.5, color: T.faint, alignSelf: "flex-start" }}>
                                {p.type === "break" ? "+ break cover" : "+ add"}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {picker && (() => {
              const p = periods.find((x) => x.id === picker.pid);
              const { stu, aid } = cellSuggestions(picker.day, p);
              return (
                <div style={{ ...S.card, marginTop: 14, boxShadow: T.shadowLift }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <div>
                      <div style={S.eyebrow}>Add support · {picker.day} · {p.label}</div>
                      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 16 }}>Pick a student, then an aide</div>
                    </div>
                    <button style={S.btnGhost} onClick={() => setPicker(null)}>Close</button>
                  </div>
                  <CellPicker stu={stu} aid={aid} aideColor={aideColor}
                    onAdd={(aideId, studentId) => { addAssignment(picker.day, picker.pid, aideId, studentId); setPicker(null); }} />
                </div>
              );
            })()}
          </>
        )}

        {/* ================= DAY-TO-DAY ================= */}
        {view === "day" && (
          <>
            <Section eyebrow="Absences & pop-ups" title="Day-to-day changes"
              right={<>
                {DAYS.map((d) => (
                  <button key={d} onClick={() => setDayView(d)}
                    style={{ ...S.btnGhost, ...(dayView === d ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>
                    {d}{overrides[d] && (overrides[d].absS.length || overrides[d].absA.length || overrides[d].added.length || overrides[d].removed.length) ? " •" : ""}
                  </button>
                ))}
                <button style={{ ...S.btnGhost, color: T.red }}
                  onClick={() => { if (confirm(`Reset all ${dayView} changes?`)) setOverrides((o) => { const n = { ...o }; delete n[dayView]; return n; }); }}>
                  Reset {dayView}
                </button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>
                Mark who's away and patch the day — the base week stays untouched. Adjusted totals flow into Support Hours.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Students absent today">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {students.map((s) => (
                      <Chip key={s.id} on={ov.absS.includes(s.id)}
                        color={{ soft: T.redSoft, line: T.redLine, text: T.red }}
                        onClick={() => setOv({ absS: ov.absS.includes(s.id) ? ov.absS.filter((x) => x !== s.id) : [...ov.absS, s.id] })}>
                        {s.name || "?"}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Aides absent today">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {aides.map((a) => (
                      <Chip key={a.id} on={ov.absA.includes(a.id)}
                        color={{ soft: T.redSoft, line: T.redLine, text: T.red }}
                        onClick={() => setOv({ absA: ov.absA.includes(a.id) ? ov.absA.filter((x) => x !== a.id) : [...ov.absA, a.id] })}>
                        {a.name || "?"}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            {/* today grid */}
            <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card, marginBottom: 16 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                <thead><tr><th style={thStyle}>Session</th><th style={thStyle}>{dayView} — adjusted schedule</th></tr></thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: p.type === "break" ? T.amberSoft : "#FAFBFD" }}>
                        {p.label}<div style={{ color: T.faint, fontWeight: 500, fontSize: 10.5 }}>{p.start}–{p.end}</div>
                      </td>
                      <td style={{ ...tdStyle }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(eff[p.id] || []).map((a) => {
                            const c = aColor(a.aideId);
                            const dead = a.studentAbsent || a.aideAbsent;
                            const isAdded = (ov.added || []).some((x) => x.id === a.id);
                            return (
                              <span key={a.id} style={{
                                ...S.pill, fontSize: 11.5,
                                background: dead ? "#F8FAFC" : c.soft,
                                borderColor: a.aideAbsent && !a.studentAbsent ? T.redLine : dead ? T.line : c.line,
                                color: dead ? T.faint : c.text,
                                textDecoration: a.studentAbsent ? "line-through" : "none",
                              }}>
                                {aName(a.aideId)} → {sName(a.studentId)}
                                {a.aideAbsent && !a.studentAbsent && <b style={{ color: T.red }}>uncovered</b>}
                                {a.studentAbsent && !a.aideAbsent && <i>freed</i>}
                                {isAdded && <span title="Today only" style={{ fontSize: 10 }}>＋today</span>}
                                {isAdded && (
                                  <button onClick={() => setOv({ added: ov.added.filter((x) => x.id !== a.id) })}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, padding: 0, fontSize: 11 }}>✕</button>
                                )}
                                {!isAdded && !dead && (
                                  <button title="Drop for today" onClick={() => setOv({ removed: [...ov.removed, a.id] })}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, padding: 0, fontSize: 11 }}>✕</button>
                                )}
                              </span>
                            );
                          })}
                          {p.type === "session" && (
                            <button onClick={() => setReassign({ periodId: p.id })}
                              style={{ ...S.btnGhost, padding: "3px 9px", fontSize: 10.5, color: T.faint }}>+ pop-up</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* issues + reassignment */}
            {(() => {
              const issues = dayIssues();
              return issues.length > 0 && (
                <Section eyebrow="Needs a decision" title={`Issues on ${dayView}`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {issues.map((it, i) => (
                      <div key={i} style={{
                        borderRadius: 12, padding: "10px 12px", fontSize: 12.5,
                        background: it.type === "uncovered" ? T.redSoft : T.greenSoft,
                        border: `1px solid ${it.type === "uncovered" ? T.redLine : T.greenLine}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                      }}>
                        <span>
                          {it.type === "uncovered"
                            ? <><b>{sName(it.a.studentId)}</b> is uncovered in {it.period.label} — {aName(it.a.aideId)} is away.</>
                            : <><b>{aName(it.a.aideId)}</b> is freed in {it.period.label} — {sName(it.a.studentId)} is away.</>}
                        </span>
                        <button style={{ ...S.btnGhost, fontSize: 11.5 }}
                          onClick={() => setReassign(it.type === "uncovered"
                            ? { periodId: it.periodId, forStudentId: it.a.studentId }
                            : { periodId: it.periodId, forAideId: it.a.aideId })}>
                          {it.type === "uncovered" ? "Find cover" : "Redeploy"}
                        </button>
                      </div>
                    ))}
                  </div>
                </Section>
              );
            })()}

            {reassign && (() => {
              const p = periods.find((x) => x.id === reassign.periodId);
              const freeA = freeAidesAt(reassign.periodId);
              const needy = needyStudentsAt(reassign.periodId);
              return (
                <div style={{ ...S.card, boxShadow: T.shadowLift }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <div>
                      <div style={S.eyebrow}>{dayView} · {p.label} · today only</div>
                      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 16 }}>
                        {reassign.forStudentId ? `Cover for ${sName(reassign.forStudentId)}`
                          : reassign.forAideId ? `Redeploy ${aName(reassign.forAideId)}`
                          : "Add a pop-up assignment"}
                      </div>
                    </div>
                    <button style={S.btnGhost} onClick={() => setReassign(null)}>Close</button>
                  </div>
                  {reassign.forStudentId ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {freeA.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>No free aides this session.</span>}
                      {freeA.map((a) => (
                        <button key={a.id} style={{ ...S.btnGhost, borderColor: aideColor(a.colorIdx).line, color: aideColor(a.colorIdx).text, background: aideColor(a.colorIdx).soft }}
                          onClick={() => {
                            setOv({ added: [...ov.added, { id: uid(), periodId: reassign.periodId, aideId: a.id, studentId: reassign.forStudentId }] });
                            setReassign(null);
                          }}>{a.name}</button>
                      ))}
                    </div>
                  ) : reassign.forAideId ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {needy.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>No students needing support this session.</span>}
                      {needy.map(({ s, deficit, subj }) => (
                        <button key={s.id} style={{ ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8 }}
                          onClick={() => {
                            setOv({ added: [...ov.added, { id: uid(), periodId: reassign.periodId, aideId: reassign.forAideId, studentId: s.id }] });
                            setReassign(null);
                          }}>
                          <span><b>{s.name}</b>{subj ? ` — in ${subj}` : ""}</span>
                          {deficit > 0 && <Pill tone="amber" style={{ fontSize: 10.5 }}>{deficit} short today</Pill>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <PopupPicker freeA={freeA} needy={needy} aideColor={aideColor}
                      onAdd={(aideId, studentId) => {
                        setOv({ added: [...ov.added, { id: uid(), periodId: reassign.periodId, aideId, studentId }] });
                        setReassign(null);
                      }} />
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ================= HOURS ================= */}
        {view === "hours" && (() => {
          const { planned, adjusted, aideLoad } = hoursData();
          return (
            <>
              <Section eyebrow="Tracking" title="Support hours per student"
                right={<button style={S.btn} onClick={exportHoursCSV}>Export CSV</button>}>
                <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>
                  Planned = the base week. Adjusted = with this week's day-to-day changes applied. Sessions are {SESSION_MIN} minutes.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                    <thead>
                      <tr>
                        {["Student", "Class", "Ideal / wk", "Planned", "Adjusted", "Against ideal"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const kl = classes.find((c) => c.id === s.classId);
                        const idealWk = (s.ideal || 0) * 5;
                        const pl = planned[s.id] || 0, ad = adjusted[s.id] || 0;
                        const pct = idealWk ? Math.min(1, ad / idealWk) : 0;
                        const short = idealWk - ad;
                        return (
                          <tr key={s.id}>
                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: F.display }}>{s.name || "?"}</td>
                            <td style={tdStyle}>{kl?.name || "—"}</td>
                            <td style={tdStyle}>{idealWk} × {SESSION_MIN}m = <b>{(idealWk * SESSION_MIN / 60).toFixed(1)}h</b></td>
                            <td style={tdStyle}>{pl} ({(pl * SESSION_MIN / 60).toFixed(1)}h)</td>
                            <td style={tdStyle}>{ad} ({(ad * SESSION_MIN / 60).toFixed(1)}h)</td>
                            <td style={{ ...tdStyle, minWidth: 180 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 8, borderRadius: 999, background: T.lineSoft, overflow: "hidden" }}>
                                  <div style={{ width: `${pct * 100}%`, height: "100%", background: pct >= 1 ? "#22C55E" : pct >= 0.7 ? "#EAB308" : "#EF4444" }} />
                                </div>
                                {short > 0
                                  ? <Pill tone="amber" style={{ fontSize: 10.5 }}>{short} short</Pill>
                                  : <Pill tone="green" style={{ fontSize: 10.5 }}>on target</Pill>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section eyebrow="Load" title="Aide load (base week)">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                  {aides.map((a) => {
                    const c = aideColor(a.colorIdx);
                    const n = aideLoad[a.id] || 0;
                    const daysWorked = DAYS.filter((d) => a.days[d]).length;
                    const cap = (a.maxPerDay || 4) * daysWorked;
                    return (
                      <div key={a.id} style={{ border: `1px solid ${c.line}`, borderLeft: `4px solid ${c.main}`, borderRadius: 12, padding: 12, background: c.soft }}>
                        <div style={{ fontFamily: F.display, fontWeight: 800, color: c.text }}>{a.name || "?"}</div>
                        <div style={{ fontSize: 12.5, marginTop: 4 }}>
                          {n} sessions / {cap} capacity · {(n * SESSION_MIN / 60).toFixed(1)}h support
                        </div>
                        <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
                          {DAYS.filter((d) => a.days[d]).join(" · ") || "no days set"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ---------- table cell styles ---------- */
const thStyle = {
  padding: "10px 12px", textAlign: "left", fontFamily: F.body, fontSize: 11, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint,
  borderBottom: `1px solid ${T.line}`, background: "#FAFBFD", position: "sticky", top: 0,
};
const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5, verticalAlign: "middle" };

/* ---------- subject chips with free-text add ---------- */
function SubjectChips({ student, classes, onChange }) {
  const [draft, setDraft] = useState("");
  // suggest from the subjects that actually appear in this student's class timetable
  const kl = classes.find((c) => c.id === student.classId);
  const known = Array.from(new Set(
    Object.values(kl?.tt || {}).flatMap((row) => Object.values(row)).filter(Boolean)
  ));
  const prefs = student.prefSubjects || [];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: known.length || prefs.length ? 6 : 0 }}>
        {prefs.map((p) => (
          <Chip key={p} on onClick={() => onChange(prefs.filter((x) => x !== p))}>{p} ✕</Chip>
        ))}
        {known.filter((s) => !prefs.some((p) => s.toLowerCase().includes(p.toLowerCase()))).slice(0, 8).map((s) => (
          <Chip key={s} on={false} onClick={() => onChange([...prefs, s])}>{s}</Chip>
        ))}
      </div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { onChange([...prefs, draft.trim()]); setDraft(""); }
        }}
        placeholder="type a subject or event, Enter to add" style={{ ...S.input, fontSize: 12 }} />
    </div>
  );
}

/* ---------- cell picker (build tab) ---------- */
function CellPicker({ stu, aid, aideColor, onAdd }) {
  const [studentId, setStudentId] = useState(null);
  const chosen = stu.find((x) => x.s.id === studentId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <div style={{ ...S.eyebrow, marginBottom: 8 }}>Students · best fit first</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {stu.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>Everyone is already covered this session.</span>}
          {stu.map(({ s, sc, subj }, i) => (
            <button key={s.id} onClick={() => setStudentId(s.id)}
              style={{
                ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8,
                ...(studentId === s.id ? { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep } : {}),
              }}>
              <span><b>{s.name}</b>{subj ? ` — in ${subj}` : ""}</span>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {i === 0 && sc > 0 && <Pill tone="green" style={{ fontSize: 10 }}>suggested</Pill>}
                {subjMatches(subj, s.prefSubjects) && <Pill tone="blue" style={{ fontSize: 10 }}>priority subject</Pill>}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...S.eyebrow, marginBottom: 8 }}>Aides · free this session</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {aid.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>No aides are free this session.</span>}
          {aid.map(({ a, load }) => {
            const c = aideColor(a.colorIdx);
            const affinity = chosen && ((chosen.s.prefAides || []).includes(a.id) || (a.worksWith || []).includes(chosen.s.id));
            return (
              <button key={a.id} disabled={!studentId} onClick={() => onAdd(a.id, studentId)}
                style={{
                  ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8,
                  borderColor: c.line, background: c.soft, color: c.text, opacity: studentId ? 1 : 0.5,
                }}>
                <span><b>{a.name}</b> · {load} today</span>
                {affinity && <Pill tone="green" style={{ fontSize: 10 }}>works well together</Pill>}
              </button>
            );
          })}
        </div>
        {!studentId && <div style={{ color: T.faint, fontSize: 11.5, marginTop: 6 }}>pick a student first</div>}
      </div>
    </div>
  );
}

/* ---------- pop-up picker (day tab) ---------- */
function PopupPicker({ freeA, needy, aideColor, onAdd }) {
  const [aideId, setAideId] = useState(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <div style={{ ...S.eyebrow, marginBottom: 8 }}>Free aides</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {freeA.length === 0 && <span style={{ color: T.faint, fontSize: 12.5 }}>No free aides this session.</span>}
          {freeA.map((a) => {
            const c = aideColor(a.colorIdx);
            return (
              <button key={a.id} onClick={() => setAideId(a.id)}
                style={{ ...S.btnGhost, textAlign: "left", borderColor: c.line, background: aideId === a.id ? c.line : c.soft, color: c.text }}>
                <b>{a.name}</b>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ ...S.eyebrow, marginBottom: 8 }}>Students · biggest need first</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {needy.map(({ s, deficit, subj }) => (
            <button key={s.id} disabled={!aideId} onClick={() => onAdd(aideId, s.id)}
              style={{ ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, opacity: aideId ? 1 : 0.5 }}>
              <span><b>{s.name}</b>{subj ? ` — in ${subj}` : ""}</span>
              {deficit > 0 && <Pill tone="amber" style={{ fontSize: 10.5 }}>{deficit} short today</Pill>}
            </button>
          ))}
        </div>
        {!aideId && <div style={{ color: T.faint, fontSize: 11.5, marginTop: 6 }}>pick an aide first</div>}
      </div>
    </div>
  );
}

/* ---------- paste box ---------- */
function PasteBox({ onPaste }) {
  const [text, setText] = useState("");
  return (
    <div style={{ marginTop: 8 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"Paste a grid — rows are Session 1–6 in order, columns Mon–Fri (tabs or commas).\nA header row of day names and a first column of session labels are both fine."}
        style={{ ...S.input, minHeight: 90, resize: "vertical" }} />
      <button style={{ ...S.btn, marginTop: 8 }} disabled={!text.trim()}
        onClick={() => { onPaste(text); setText(""); }}>
        Fill grid from paste
      </button>
    </div>
  );
}
