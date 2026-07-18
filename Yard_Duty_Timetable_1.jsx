import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   YARD DUTY TIMETABLE — fair-share duty roster
   CPS · Timetables (B10) · standalone tool · Chunk & Check aesthetic

   · Staff with availability, weekly duty load caps, and areas
     they can/prefer to cover
   · Zones (areas) each break slot needs covered, with how many
     staff each zone requires
   · Fair-share generator — spreads duties evenly by minutes,
     protects a staff member's own break (never both breaks in
     a day), honours "can't cover" and unavailability
   · Generate → lock → repair: locked duties are kept
   · Coverage dashboard — under-staffed slots, unfair loads,
     back-to-back duties flagged
   · Day-to-day swaps and absences overlay the base roster
   · Load tab — minutes per staff member, balance view, CSV export
   · Import pre-information (text/docx/xlsx/pdf/image); autosave + JSON
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

/* zone colours */
const ZONE_COLORS = [
  { main: "#16A34A", text: "#15803D", soft: "#F0FDF4", line: "#BBF7D0" }, // green
  { main: "#2563EB", text: "#1D4ED8", soft: "#EFF6FF", line: "#BFDBFE" }, // blue
  { main: "#EA580C", text: "#C2410C", soft: "#FFF7ED", line: "#FED7AA" }, // orange
  { main: "#7C3AED", text: "#6D28D9", soft: "#F5F3FF", line: "#DDD6FE" }, // violet
  { main: "#0D9488", text: "#0F766E", soft: "#F0FDFA", line: "#99F6E4" }, // teal
  { main: "#DB2777", text: "#BE185D", soft: "#FDF2F8", line: "#FBCFE8" }, // pink
  { main: "#CA8A04", text: "#A16207", soft: "#FEFCE8", line: "#FDE68A" }, // gold
];
const zoneColor = (idx) => ZONE_COLORS[idx % ZONE_COLORS.length];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_SLOTS = [
  { id: "brec", label: "Before School", start: "8:45", end: "9:00", mins: 15 },
  { id: "rec", label: "Recess", start: "10:40", end: "11:10", mins: 30 },
  { id: "lun1", label: "Lunch (eating)", start: "12:50", end: "13:00", mins: 10 },
  { id: "lun2", label: "Lunch (play)", start: "13:00", end: "13:40", mins: 40 },
];
const STORAGE_KEY = "i3s-yard-duty-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const ck = (day, sid, zid) => `${day}|${sid}|${zid}`;

/* ---------- Anthropic API helper ---------- */
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
      { type: "text", text: "Extract ALL the text from this document verbatim, preserving structure. Output ONLY the extracted text." },
    ] }], 6000);
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || file.type.startsWith("image/")) {
    const media = file.type?.startsWith("image/") ? file.type : ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "image/png");
    const b64 = await fileToBase64(file);
    return await askClaude([{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: media, data: b64 } },
      { type: "text", text: "Transcribe ALL text visible in this image verbatim, preserving any grid structure. Output ONLY the transcription." },
    ] }], 6000);
  }
  throw new Error(`Can't read .${ext} — use .docx, .xlsx, .pdf, an image, or paste the text.`);
}

/* ---------- fair-share generator ---------- */
function slotMins(slots, sid) { return slots.find((s) => s.id === sid)?.mins || 0; }

function generateRoster({ days, slots, zones, staff, base }) {
  const next = {};
  for (const key of Object.keys(base || {})) {
    if (base[key]?.locked) next[key] = base[key];
  }
  // running load (minutes) per staff, seeded from locked duties
  const load = {};
  staff.forEach((p) => (load[p.id] = 0));
  Object.entries(next).forEach(([key, v]) => {
    const [, sid] = key.split("|");
    if (v?.staffId != null) load[v.staffId] = (load[v.staffId] || 0) + slotMins(slots, sid);
  });

  // build the list of required slots to fill, ordered so scarce zones go first
  const openings = [];
  for (const day of days) for (const s of slots) for (const z of zones) {
    const need = z.perSlot ?? 1;
    for (let i = 0; i < need; i++) openings.push({ day, sid: s.id, zid: z.id, i, mins: s.mins });
  }

  for (const op of openings) {
    const key = ck(op.day, op.sid, op.zid) + (op.i ? `#${op.i}` : "");
    if (next[key]?.locked) continue;
    // who's already on duty this day+slot (can't be in two zones at once)
    const busy = new Set();
    Object.entries(next).forEach(([k, v]) => {
      const [d, sid] = k.split("|");
      if (d === op.day && sid === op.sid && v?.staffId != null) busy.add(v.staffId);
    });
    // who already has a duty in a break slot this day (protect own break — no two break duties same day)
    const dayBreakLoad = {};
    Object.entries(next).forEach(([k, v]) => {
      const [d] = k.split("|");
      if (d === op.day && v?.staffId != null) dayBreakLoad[v.staffId] = (dayBreakLoad[v.staffId] || 0) + 1;
    });
    const cands = staff.filter((p) =>
      p.days?.[op.day] &&
      !busy.has(p.id) &&
      !(p.cantCover || []).includes(op.zid) &&
      (dayBreakLoad[p.id] || 0) < (p.maxPerDay || 2) &&
      (load[p.id] || 0) < (p.weeklyCapMins || 999999));
    if (!cands.length) { next[key] = { staffId: null, locked: false }; continue; }
    // rank: prefers this zone → fewest duties today → lowest weekly load
    cands.sort((a, b) => {
      const pa = (a.prefZones || []).includes(op.zid) ? 0 : 1;
      const pb = (b.prefZones || []).includes(op.zid) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = dayBreakLoad[a.id] || 0, db = dayBreakLoad[b.id] || 0;
      if (da !== db) return da - db;
      return (load[a.id] || 0) - (load[b.id] || 0);
    });
    const pick = cands[0];
    next[key] = { staffId: pick.id, locked: false };
    load[pick.id] += op.mins;
  }
  return next;
}

function rosterConflicts({ days, slots, zones, staff, base }) {
  const out = [];
  const byId = (id) => staff.find((p) => p.id === id);
  for (const day of days) {
    const dayDuty = {};
    for (const s of slots) {
      const inSlot = {};
      for (const z of zones) {
        const need = z.perSlot ?? 1;
        let filled = 0;
        for (let i = 0; i < need; i++) {
          const key = ck(day, s.id, z.id) + (i ? `#${i}` : "");
          const cell = base[key];
          if (cell?.staffId) {
            filled++;
            const p = byId(cell.staffId);
            if (!p) continue;
            if (inSlot[cell.staffId]) out.push({ level: "hard", text: `${day} ${s.label}: ${p.name} is rostered in two zones at once` });
            inSlot[cell.staffId] = true;
            if (!p.days?.[day]) out.push({ level: "hard", text: `${day} ${s.label}: ${p.name} isn't available ${day}s` });
            if ((p.cantCover || []).includes(z.id)) out.push({ level: "hard", text: `${day} ${s.label} · ${z.name}: ${p.name} can't cover this zone` });
            dayDuty[cell.staffId] = (dayDuty[cell.staffId] || 0) + 1;
          }
        }
        if (filled < need) out.push({ level: "soft", text: `${day} ${s.label} · ${z.name}: needs ${need}, has ${filled}` });
      }
    }
    for (const sid of Object.keys(dayDuty)) {
      const p = byId(sid);
      if (p && dayDuty[sid] > (p.maxPerDay || 2))
        out.push({ level: "soft", text: `${day}: ${p.name} has ${dayDuty[sid]} duties (cap ${p.maxPerDay || 2}) — no break protected` });
    }
  }
  return out;
}

/* ---------- shared UI ---------- */
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
      ? (color ? { background: color.soft, borderColor: color.line, color: color.text } : { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep })
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
const thStyle = {
  padding: "10px 12px", textAlign: "left", fontFamily: F.body, fontSize: 11, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint,
  borderBottom: `1px solid ${T.line}`, background: "#FAFBFD", position: "sticky", top: 0,
};
const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5, verticalAlign: "top" };

/* ============================================================ */
export default function App() {
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [zones, setZones] = useState([]);
  const [staff, setStaff] = useState([]);
  const [base, setBase] = useState({});
  const [overrides, setOverrides] = useState({});
  const [view, setView] = useState("setup");
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef(null);
  const jsonRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.slots) setSlots(d.slots);
        if (d.zones) setZones(d.zones);
        if (d.staff) setStaff(d.staff);
        if (d.base) setBase(d.base);
        if (d.overrides) setOverrides(d.overrides);
      }
    } catch (e) { /* fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots, zones, staff, base, overrides }));
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 900);
      return () => clearTimeout(t);
    } catch (e) { /* full */ }
  }, [slots, zones, staff, base, overrides, loaded]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ slots, zones, staff, base, overrides }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "yard-duty.json"; a.click();
  };
  const importJSON = async (file) => {
    try {
      const d = JSON.parse(await fileToText(file));
      if (d.slots) setSlots(d.slots);
      setZones(d.zones || []); setStaff(d.staff || []); setBase(d.base || {}); setOverrides(d.overrides || {});
    } catch (e) { alert("Couldn't read that JSON file."); }
  };

  const upStaff = (id, patch) => setStaff((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const upZone = (id, patch) => setZones((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addStaff = () => setStaff((xs) => [...xs, {
    id: uid(), name: "", maxPerDay: 2, weeklyCapMins: 120,
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
    prefZones: [], cantCover: [], notes: "", active: true,
  }]);
  const addZone = () => setZones((xs) => [...xs, { id: uid(), name: "", perSlot: 1, colorIdx: xs.length }]);
  const delStaff = (id) => {
    setStaff((xs) => xs.filter((x) => x.id !== id));
    setBase((b) => { const n = { ...b }; for (const k of Object.keys(n)) if (n[k]?.staffId === id) n[k] = { ...n[k], staffId: null }; return n; });
  };
  const delZone = (id) => {
    setZones((xs) => xs.filter((x) => x.id !== id));
    setBase((b) => { const n = {}; for (const k of Object.keys(b)) if (!k.includes(`|${id}`)) n[k] = b[k]; return n; });
  };

  const pName = (id) => staff.find((p) => p.id === id)?.name || "?";
  const zName = (id) => zones.find((z) => z.id === id)?.name || "?";
  const zColor = (id) => zoneColor(zones.find((z) => z.id === id)?.colorIdx ?? 0);

  const conflicts = rosterConflicts({ days: DAYS, slots, zones, staff, base });

  /* ---- AI pre-info import ---- */
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  async function runImport(sourceText) {
    setImportBusy(true); setImportMsg("Reading and extracting…");
    try {
      const slotLabels = slots.map((s) => `${s.label} (${s.mins}min)`).join(", ");
      const prompt = `You are pre-filling a school yard-duty roster tool. Break slots are: ${slotLabels}. Days Mon–Fri.
From the source below, extract into this exact JSON (omit arrays with nothing found):
{
 "zones":[{"name":"","staffPerSlot":1}],
 "staff":[{"name":"","days":["Mon","Tue","Wed","Thu","Fri"],"maxDutiesPerDay":2,"weeklyCapMinutes":120,"preferredZones":["zone name"],"cannotCover":["zone name"],"notes":""}]
}
Use names exactly as written. Output ONLY the JSON.

SOURCE:
${sourceText}`;
      const data = parseJSON(await askClaude([{ role: "user", content: prompt }], 5000));

      const newZones = [...zones];
      for (const z of data.zones || []) {
        if (!z.name) continue;
        let zn = newZones.find((x) => x.name.toLowerCase() === z.name.toLowerCase());
        if (!zn) { zn = { id: uid(), name: z.name, perSlot: z.staffPerSlot || 1, colorIdx: newZones.length }; newZones.push(zn); }
        else if (z.staffPerSlot) zn.perSlot = z.staffPerSlot;
      }
      const newStaff = [...staff];
      for (const p of data.staff || []) {
        if (!p.name) continue;
        let pn = newStaff.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
        if (!pn) {
          pn = { id: uid(), name: p.name, maxPerDay: p.maxDutiesPerDay || 2, weeklyCapMins: p.weeklyCapMinutes || 120, days: {}, prefZones: [], cantCover: [], notes: p.notes || "", active: true };
          DAYS.forEach((d) => { pn.days[d] = p.days ? p.days.includes(d) : true; });
          newStaff.push(pn);
        } else if (p.days) DAYS.forEach((d) => { pn.days[d] = p.days.includes(d); });
        pn._pref = p.preferredZones || [];
        pn._cant = p.cannotCover || [];
      }
      for (const pn of newStaff) {
        if (pn._pref) { pn.prefZones = Array.from(new Set([...(pn.prefZones || []), ...pn._pref.map((n) => newZones.find((z) => z.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean)])); delete pn._pref; }
        if (pn._cant) { pn.cantCover = Array.from(new Set([...(pn.cantCover || []), ...pn._cant.map((n) => newZones.find((z) => z.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean)])); delete pn._cant; }
      }
      setZones(newZones); setStaff(newStaff);
      setImportMsg(`Imported: ${(data.zones || []).length} zones · ${(data.staff || []).length} staff.`);
      setImportText("");
    } catch (e) { setImportMsg(`Import failed — ${e.message || e}`); }
    setImportBusy(false);
  }

  /* ---- cell assign ---- */
  const cellKeys = (day, sid, zid) => {
    const z = zones.find((x) => x.id === zid); const need = z?.perSlot ?? 1;
    return Array.from({ length: need }, (_, i) => ck(day, sid, zid) + (i ? `#${i}` : ""));
  };
  const setCell = (key, staffId, lock = true) => setBase((b) => ({ ...b, [key]: { staffId, locked: lock } }));
  const toggleLock = (key) => setBase((b) => ({ ...b, [key]: { ...(b[key] || { staffId: null }), locked: !b[key]?.locked } }));
  const clearCell = (key) => setBase((b) => { const n = { ...b }; delete n[key]; return n; });

  const [picker, setPicker] = useState(null); // {key, day, sid, zid}
  function pickerCandidates(day, sid, zid) {
    const busy = new Set();
    Object.entries(base).forEach(([k, v]) => { const [d, s] = k.split("|"); if (d === day && s === sid && v?.staffId) busy.add(v.staffId); });
    const dayDuty = {};
    Object.entries(base).forEach(([k, v]) => { const [d] = k.split("|"); if (d === day && v?.staffId) dayDuty[v.staffId] = (dayDuty[v.staffId] || 0) + 1; });
    const wkLoad = {};
    Object.entries(base).forEach(([k, v]) => { const [, s] = k.split("|"); if (v?.staffId) wkLoad[v.staffId] = (wkLoad[v.staffId] || 0) + slotMins(slots, s); });
    return staff.filter((p) => p.active !== false && p.days?.[day] && !busy.has(p.id))
      .map((p) => ({
        p,
        can: !(p.cantCover || []).includes(zid),
        pref: (p.prefZones || []).includes(zid),
        today: dayDuty[p.id] || 0,
        load: wkLoad[p.id] || 0,
        over: (dayDuty[p.id] || 0) >= (p.maxPerDay || 2),
      }))
      .sort((a, b) => (a.pref === b.pref ? a.load - b.load : a.pref ? -1 : 1));
  }

  /* ---- day-to-day ---- */
  const [dayView, setDayView] = useState("Mon");
  const ov = overrides[dayView] || { absent: [], swaps: {} }; // swaps: key -> staffId (today only)
  const setOv = (patch) => setOverrides((o) => ({ ...o, [dayView]: { ...ov, ...patch } }));
  const effStaff = (key) => (ov.swaps?.[key] !== undefined ? ov.swaps[key] : base[key]?.staffId ?? null);
  const [swapPicker, setSwapPicker] = useState(null);

  /* ---- load ---- */
  function loadData() {
    const base_ = {}, adj = {};
    staff.forEach((p) => { base_[p.id] = 0; adj[p.id] = 0; });
    for (const day of DAYS) {
      const o = overrides[day] || { absent: [], swaps: {} };
      for (const s of slots) for (const z of zones) {
        for (const key of cellKeys(day, s.id, z.id)) {
          const b = base[key]?.staffId;
          if (b != null) base_[b] = (base_[b] || 0) + s.mins;
          const eff = o.swaps?.[key] !== undefined ? o.swaps[key] : b;
          if (eff != null && !o.absent.includes(eff)) adj[eff] = (adj[eff] || 0) + s.mins;
        }
      }
    }
    return { base_, adj };
  }
  function exportCSV() {
    const { base_, adj } = loadData();
    const rows = [["Staff", "Available days", "Weekly cap (min)", "Planned duty (min)", "Adjusted duty (min)"]];
    for (const p of staff) rows.push([p.name, DAYS.filter((d) => p.days?.[d]).join(" "), p.weeklyCapMins || "", base_[p.id] || 0, adj[p.id] || 0]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "yard-duty-load.csv"; a.click();
  }

  const VIEWS = [["setup", "Staff & Zones"], ["build", "Build the Roster"], ["day", "Day-to-Day"], ["load", "Duty Load"]];

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
              <div style={S.eyebrow}>CPS · Timetables · Standalone Tool</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", margin: "12px 0 6px" }}>Yard Duty Timetable</h1>
              <div style={{ color: T.sub, fontSize: 13.5, maxWidth: 640 }}>
                A fair-share duty roster — spreads minutes evenly, protects everyone's break, covers every zone, and lets you patch day-to-day absences without rebuilding the week.
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
                style={{ ...S.btnGhost, ...(view === k ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 60px" }}>

        {/* SETUP */}
        {view === "setup" && (
          <>
            <Section eyebrow="Pre-fill" title="Import pre-information"
              right={<>
                <button style={S.btnGhost} disabled={importBusy} onClick={() => fileRef.current?.click()}>{importBusy ? "Working…" : "Upload a file"}</button>
                <input ref={fileRef} type="file" style={{ display: "none" }}
                  onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; setImportBusy(true); setImportMsg("Reading file…"); try { await runImport(await extractSourceText(f)); } catch (err) { setImportMsg(`Import failed — ${err.message || err}`); setImportBusy(false); } }} />
                <button style={S.btn} disabled={importBusy || !importText.trim()} onClick={() => runImport(importText)}>{importBusy ? "Extracting…" : "Extract & pre-fill"}</button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>Paste a staff list, last term's roster, or duty notes — or upload a file — and it pre-fills staff and zones.</div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder={"e.g.  Basketball court needs 2 staff each break.\nMr Lee: Mon–Thu, prefers the oval, can't do before-school…"}
                style={{ ...S.input, minHeight: 90, resize: "vertical" }} />
              {importMsg && <div style={{ marginTop: 8 }}><Pill tone={importMsg.startsWith("Import failed") ? "red" : "green"} style={{ fontSize: 11.5 }}>{importMsg}</Pill></div>}
            </Section>

            <Section eyebrow="Areas to cover" title="Zones"
              right={<button style={S.btn} onClick={addZone}>+ Add zone</button>}>
              {zones.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No zones yet — add the areas that need a duty (oval, courts, quad, before-school gate…).</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {zones.map((z) => {
                  const c = zoneColor(z.colorIdx);
                  return (
                    <div key={z.id} style={{ border: `1px solid ${T.line}`, borderLeft: `4px solid ${c.main}`, borderRadius: 14, padding: 14, background: "#FCFDFE" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input value={z.name} onChange={(e) => upZone(z.id, { name: e.target.value })} placeholder="Zone name" style={{ ...S.input, fontWeight: 700, fontFamily: F.display }} />
                        <button onClick={() => delZone(z.id)} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 14 }}>✕</button>
                      </div>
                      <Field label="Staff needed each break slot">
                        <input type="number" min={1} max={6} value={z.perSlot ?? 1} onChange={(e) => upZone(z.id, { perSlot: Math.max(1, Number(e.target.value) || 1) })} style={{ ...S.input, width: 90 }} />
                      </Field>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section eyebrow="Who's on duty" title="Staff"
              right={<button style={S.btn} onClick={addStaff}>+ Add staff</button>}>
              {staff.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No staff yet.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {staff.map((p) => (
                  <div key={p.id} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: p.active === false ? "#F8FAFC" : "#FCFDFE", opacity: p.active === false ? 0.65 : 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <input value={p.name} onChange={(e) => upStaff(p.id, { name: e.target.value })} placeholder="Staff name" style={{ ...S.input, fontWeight: 700, fontFamily: F.display }} />
                      <Toggle on={p.active !== false} onClick={() => upStaff(p.id, { active: p.active === false })}>active</Toggle>
                      <button onClick={() => delStaff(p.id)} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 14 }}>✕</button>
                    </div>
                    <Field label="Available days" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {DAYS.map((d) => <Chip key={d} on={!!p.days?.[d]} onClick={() => upStaff(p.id, { days: { ...p.days, [d]: !p.days?.[d] } })}>{d}</Chip>)}
                      </div>
                    </Field>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <Field label="Max duties / day" style={{ flex: "0 0 130px" }}>
                        <input type="number" min={1} max={slots.length} value={p.maxPerDay || 2} onChange={(e) => upStaff(p.id, { maxPerDay: Math.max(1, Number(e.target.value) || 1) })} style={{ ...S.input, width: 80 }} />
                      </Field>
                      <Field label="Weekly cap (min)" style={{ flex: "0 0 150px" }}>
                        <input type="number" min={0} step={10} value={p.weeklyCapMins || 0} onChange={(e) => upStaff(p.id, { weeklyCapMins: Math.max(0, Number(e.target.value) || 0) })} style={{ ...S.input, width: 90 }} />
                      </Field>
                    </div>
                    <Field label="Prefers these zones" style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {zones.length === 0 && <span style={{ color: T.faint, fontSize: 12 }}>add zones first</span>}
                        {zones.map((z) => (
                          <Chip key={z.id} color={zoneColor(z.colorIdx)} on={(p.prefZones || []).includes(z.id)}
                            onClick={() => upStaff(p.id, { prefZones: (p.prefZones || []).includes(z.id) ? p.prefZones.filter((x) => x !== z.id) : [...(p.prefZones || []), z.id] })}>{z.name || "?"}</Chip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Can't cover" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {zones.map((z) => (
                          <Chip key={z.id} color={{ soft: T.redSoft, line: T.redLine, text: T.red }} on={(p.cantCover || []).includes(z.id)}
                            onClick={() => upStaff(p.id, { cantCover: (p.cantCover || []).includes(z.id) ? p.cantCover.filter((x) => x !== z.id) : [...(p.cantCover || []), z.id] })}>{z.name || "?"}</Chip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Notes">
                      <input value={p.notes || ""} onChange={(e) => upStaff(p.id, { notes: e.target.value })} placeholder="e.g. RFF Wed, no before-school" style={S.input} />
                    </Field>
                  </div>
                ))}
              </div>
            </Section>

            <Section eyebrow="Day structure" title="Break slots">
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>The duty slots the roster covers. Minutes feed the fair-share balancing and the load totals.</div>
              <div style={{ display: "grid", gap: 6 }}>
                {slots.map((sl, i) => (
                  <div key={sl.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={sl.label} onChange={(e) => setSlots((ss) => ss.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))} style={{ ...S.input, width: 200 }} />
                    <input value={sl.start} onChange={(e) => setSlots((ss) => ss.map((x, xi) => (xi === i ? { ...x, start: e.target.value } : x)))} style={{ ...S.input, width: 80 }} />
                    <span style={{ color: T.faint }}>–</span>
                    <input value={sl.end} onChange={(e) => setSlots((ss) => ss.map((x, xi) => (xi === i ? { ...x, end: e.target.value } : x)))} style={{ ...S.input, width: 80 }} />
                    <input type="number" value={sl.mins} onChange={(e) => setSlots((ss) => ss.map((x, xi) => (xi === i ? { ...x, mins: Math.max(0, Number(e.target.value) || 0) } : x)))} style={{ ...S.input, width: 80 }} />
                    <span style={{ color: T.faint, fontSize: 11.5 }}>min</span>
                    <button onClick={() => setSlots((ss) => ss.filter((_, xi) => xi !== i))} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint }}>✕</button>
                  </div>
                ))}
                <button style={{ ...S.btnGhost, alignSelf: "flex-start", marginTop: 4 }}
                  onClick={() => setSlots((ss) => [...ss, { id: uid(), label: "New slot", start: "", end: "", mins: 30 }])}>+ Add slot</button>
              </div>
            </Section>
          </>
        )}

        {/* BUILD */}
        {view === "build" && (
          <>
            <Section eyebrow="Generate · lock · repair" title="The base roster"
              right={<>
                <button style={S.btnGhost} onClick={() => { if (confirm("Clear all unlocked duties?")) setBase((b) => { const n = {}; for (const k of Object.keys(b)) if (b[k]?.locked) n[k] = b[k]; return n; }); }}>Clear unlocked</button>
                <button style={S.btn} onClick={() => setBase(generateRoster({ days: DAYS, slots, zones, staff, base }))}>Generate roster</button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5 }}>Fair-share fills every zone across all break slots, evening out minutes and protecting each person's break (never both breaks in a day). Lock (🔒) anything you want kept, then regenerate.</div>
              {conflicts.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{ borderRadius: 10, padding: "7px 12px", fontSize: 12.5, background: c.level === "hard" ? T.redSoft : T.amberSoft, border: `1px solid ${c.level === "hard" ? T.redLine : T.amberLine}`, color: c.level === "hard" ? T.red : T.amber }}>{c.level === "hard" ? "⚠ " : "◦ "}{c.text}</div>
                  ))}
                </div>
              )}
            </Section>

            {zones.length === 0 || staff.length === 0 ? (
              <div style={{ ...S.card, color: T.faint, fontSize: 13 }}>Add at least one zone and one staff member in Setup to build a roster.</div>
            ) : (
              <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Slot</th>
                      <th style={thStyle}>Zone</th>
                      {DAYS.map((d) => <th key={d} style={thStyle}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((sl) => zones.map((z, zi) => {
                      const c = zoneColor(z.colorIdx);
                      return (
                        <tr key={sl.id + z.id}>
                          {zi === 0 && (
                            <td rowSpan={zones.length} style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: "#FAFBFD", verticalAlign: "top" }}>
                              {sl.label}<div style={{ color: T.faint, fontWeight: 500, fontSize: 10.5 }}>{sl.start}–{sl.end} · {sl.mins}m</div>
                            </td>
                          )}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", borderLeft: `3px solid ${c.main}`, background: c.soft, color: c.text, fontWeight: 700 }}>{z.name || "?"}</td>
                          {DAYS.map((d) => (
                            <td key={d} style={{ ...tdStyle, minWidth: 130 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {cellKeys(d, sl.id, z.id).map((key) => {
                                  const cell = base[key];
                                  return cell?.staffId ? (
                                    <div key={key} style={{ borderRadius: 9, padding: "5px 8px", fontSize: 11.5, background: c.soft, border: `1px solid ${c.line}`, display: "flex", justifyContent: "space-between", gap: 4 }}>
                                      <span style={{ fontWeight: 700, color: c.text }}>{pName(cell.staffId)}</span>
                                      <span style={{ display: "inline-flex", gap: 4 }}>
                                        <button title={cell.locked ? "Unlock" : "Lock"} onClick={() => toggleLock(key)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, padding: 0, opacity: cell.locked ? 1 : 0.35 }}>🔒</button>
                                        <button title="Clear" onClick={() => clearCell(key)} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 11, padding: 0 }}>✕</button>
                                      </span>
                                    </div>
                                  ) : (
                                    <button key={key} onClick={() => setPicker({ key, day: d, sid: sl.id, zid: z.id })}
                                      style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 10.5, color: T.red, borderColor: T.redLine, background: T.redSoft }}>+ assign</button>
                                  );
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            )}

            {picker && (
              <div style={{ ...S.card, marginTop: 14, boxShadow: T.shadowLift }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <div style={S.eyebrow}>{picker.day} · {slots.find((s) => s.id === picker.sid)?.label} · {zName(picker.zid)}</div>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 16 }}>Assign a staff member</div>
                  </div>
                  <button style={S.btnGhost} onClick={() => setPicker(null)}>Close</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
                  {pickerCandidates(picker.day, picker.sid, picker.zid).map(({ p, can, pref, today, load, over }) => (
                    <button key={p.id} disabled={!can} onClick={() => { setCell(picker.key, p.id); setPicker(null); }}
                      style={{ ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, opacity: can ? 1 : 0.4 }}>
                      <span><b>{p.name}</b> · {load} min this wk · {today} today</span>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        {!can && <Pill tone="red" style={{ fontSize: 10 }}>can't cover</Pill>}
                        {can && pref && <Pill tone="green" style={{ fontSize: 10 }}>prefers here</Pill>}
                        {can && over && <Pill tone="amber" style={{ fontSize: 10 }}>at daily cap</Pill>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* DAY-TO-DAY */}
        {view === "day" && (
          <>
            <Section eyebrow="Absences & swaps" title="Day-to-day changes"
              right={<>
                {DAYS.map((d) => (
                  <button key={d} onClick={() => setDayView(d)} style={{ ...S.btnGhost, ...(dayView === d ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>
                    {d}{overrides[d] && (overrides[d].absent.length || Object.keys(overrides[d].swaps || {}).length) ? " •" : ""}
                  </button>
                ))}
                <button style={{ ...S.btnGhost, color: T.red }} onClick={() => { if (confirm(`Reset all ${dayView} changes?`)) setOverrides((o) => { const n = { ...o }; delete n[dayView]; return n; }); }}>Reset {dayView}</button>
              </>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>Mark who's away and swap cover for the day — the base roster stays untouched, and Duty Load shows the adjusted totals.</div>
              <Field label="Staff absent today">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {staff.map((p) => (
                    <Chip key={p.id} on={ov.absent.includes(p.id)} color={{ soft: T.redSoft, line: T.redLine, text: T.red }}
                      onClick={() => setOv({ absent: ov.absent.includes(p.id) ? ov.absent.filter((x) => x !== p.id) : [...ov.absent, p.id] })}>{p.name || "?"}</Chip>
                  ))}
                </div>
              </Field>
            </Section>

            <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card, marginBottom: 16 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                <thead><tr><th style={thStyle}>Slot</th><th style={thStyle}>Zone</th><th style={thStyle}>{dayView} — cover</th></tr></thead>
                <tbody>
                  {slots.map((sl) => zones.map((z, zi) => {
                    const c = zoneColor(z.colorIdx);
                    return (
                      <tr key={sl.id + z.id}>
                        {zi === 0 && <td rowSpan={zones.length} style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: "#FAFBFD" }}>{sl.label}<div style={{ color: T.faint, fontWeight: 500, fontSize: 10.5 }}>{sl.mins}m</div></td>}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", borderLeft: `3px solid ${c.main}`, background: c.soft, color: c.text, fontWeight: 700 }}>{z.name || "?"}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {cellKeys(dayView, sl.id, z.id).map((key) => {
                              const sid = effStaff(key);
                              const away = sid != null && ov.absent.includes(sid);
                              const swapped = ov.swaps?.[key] !== undefined;
                              return (
                                <span key={key} style={{ ...S.pill, fontSize: 11.5, background: away ? T.redSoft : c.soft, borderColor: away ? T.redLine : c.line, color: away ? T.red : c.text }}>
                                  {sid != null ? pName(sid) : <i style={{ color: T.faint }}>unfilled</i>}
                                  {away && <b>away</b>}
                                  {swapped && !away && <span style={{ fontSize: 10 }}>swapped</span>}
                                  <button title="Swap for today" onClick={() => setSwapPicker({ key, day: dayView, sid: sl.id, zid: z.id })}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: away ? T.red : T.faint, padding: 0, fontSize: 12, fontWeight: 700 }}>⇄</button>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>

            {swapPicker && (
              <div style={{ ...S.card, boxShadow: T.shadowLift }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <div style={S.eyebrow}>{swapPicker.day} · {slots.find((s) => s.id === swapPicker.sid)?.label} · {zName(swapPicker.zid)} · today only</div>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 16 }}>Swap cover</div>
                  </div>
                  <button style={S.btnGhost} onClick={() => setSwapPicker(null)}>Close</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  <button style={{ ...S.btnGhost, textAlign: "left", color: T.faint }}
                    onClick={() => { setOv({ swaps: { ...ov.swaps, [swapPicker.key]: null } }); setSwapPicker(null); }}>Leave unfilled today</button>
                  {pickerCandidates(swapPicker.day, swapPicker.sid, swapPicker.zid).filter(({ p }) => !ov.absent.includes(p.id)).map(({ p, can, pref, today, load }) => (
                    <button key={p.id} disabled={!can} onClick={() => { setOv({ swaps: { ...ov.swaps, [swapPicker.key]: p.id } }); setSwapPicker(null); }}
                      style={{ ...S.btnGhost, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, opacity: can ? 1 : 0.4 }}>
                      <span><b>{p.name}</b> · {today} duties today</span>
                      {can && pref && <Pill tone="green" style={{ fontSize: 10 }}>prefers here</Pill>}
                      {!can && <Pill tone="red" style={{ fontSize: 10 }}>can't cover</Pill>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* LOAD */}
        {view === "load" && (() => {
          const { base_, adj } = loadData();
          const vals = staff.map((p) => base_[p.id] || 0);
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          const max = Math.max(1, ...vals);
          return (
            <Section eyebrow="Fairness & tracking" title="Duty load per staff member"
              right={<button style={S.btn} onClick={exportCSV}>Export CSV</button>}>
              <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>
                Planned = base roster minutes. Adjusted = with this week's absences and swaps applied. Team average is {Math.round(avg)} min/week — bars past it carry more than their share.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {staff.map((p) => {
                  const pl = base_[p.id] || 0, ad = adj[p.id] || 0;
                  const overCap = p.weeklyCapMins && pl > p.weeklyCapMins;
                  const heavy = pl > avg * 1.25;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 150, fontWeight: 700, fontFamily: F.display, fontSize: 13 }}>{p.name || "?"}</div>
                      <div style={{ flex: 1, height: 20, borderRadius: 999, background: T.lineSoft, overflow: "hidden", position: "relative" }}>
                        <div style={{ width: `${(pl / max) * 100}%`, height: "100%", background: overCap ? "#EF4444" : heavy ? "#EAB308" : "#22C55E" }} />
                        <div style={{ position: "absolute", left: `${(avg / max) * 100}%`, top: 0, bottom: 0, width: 2, background: T.ink, opacity: 0.35 }} title="team average" />
                      </div>
                      <div style={{ width: 190, fontSize: 12, color: T.sub, textAlign: "right" }}>
                        {pl}m planned{ad !== pl && <> · <b style={{ color: ad < pl ? T.green : T.amber }}>{ad}m adjusted</b></>}
                        {overCap && <> · <span style={{ color: T.red }}>over cap</span></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}
      </div>
    </div>
  );
}
