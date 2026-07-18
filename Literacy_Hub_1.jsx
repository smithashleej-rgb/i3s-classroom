import React, { useState, useRef } from "react";

/* ============================================================
   LITERACY HUB — Sentence Science · correlation · levelled texts
   CPS · B7 · standalone tool · Chunk & Check aesthetic

   Three surfaces, one place:
   · Sentence Science hub — the colour system (Subject=red,
     Verb=green, Object=orange, +structure colours), the ABOYS
     compound anchor (reindeer + "Santa clauses"), imposters,
     dependent conjunctions, and the F–6 "I can" progression.
     Plus a live colour annotator that marks up any sentence.
   · Correlation table — single source of truth linking CARS &
     STARS levels ↔ VC2.0 ↔ F&P ↔ PM, with the CPS colour ladder.
   · Levelled text generator — any text type at an identified
     level (CARS/STARS or VC2.0), based on a lens or a described
     text; re-level up/down; auto Sentence Science annotation on
     the mentor text.
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
const Section = ({ eyebrow, title, right, children }) => (
  <div style={{ ...S.card, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      <div><div style={S.eyebrow}>{eyebrow}</div><div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{title}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>
    </div>
    {children}
  </div>
);
const Field = ({ label, children, style = {} }) => (<div style={style}><label style={S.label}>{label}</label>{children}</div>);

/* ---------- Sentence Science colour system (CPS) ---------- */
const SS = {
  subject: { key: "s", name: "Subject", color: "#DC2626", soft: "#FEF2F2", line: "#FECACA", ink: "#7F1D1D" },     // red
  verb: { key: "v", name: "Verb group", color: "#16A34A", soft: "#F0FDF4", line: "#BBF7D0", ink: "#14532D" },    // green
  object: { key: "o", name: "Object", color: "#EA580C", soft: "#FFF7ED", line: "#FED7AA", ink: "#7C2D12" },      // orange
  conj: { key: "c", name: "Conjunction", color: "#7C3AED", soft: "#F5F3FF", line: "#DDD6FE", ink: "#4C1D95" },   // violet
  adverbial: { key: "a", name: "Adverbial", color: "#0891B2", soft: "#ECFEFF", line: "#A5F3FC", ink: "#164E63" }, // cyan
  extra: { key: "x", name: "Other structure", color: "#64748B", soft: "#F1F5F9", line: "#E2E8F0", ink: "#334155" },
};
const SS_ORDER = ["subject", "verb", "object", "conj", "adverbial", "extra"];
const partStyle = (part) => {
  const p = SS[part] || SS.extra;
  return { background: p.soft, color: p.ink, borderBottom: `2px solid ${p.color}`, borderRadius: 4, padding: "0 2px" };
};

const ABOYS = [
  { word: "And", reindeer: "Andy", note: "adds" },
  { word: "But", reindeer: "Butzy", note: "contrasts" },
  { word: "Or", reindeer: "Orty", note: "offers a choice" },
  { word: "Yet", reindeer: "Yeti", note: "contrasts (still)" },
  { word: "So", reindeer: "Soapy", note: "shows a result" },
];
const DEPENDENTS = ["if", "since", "when", "after", "until", "as", "while", "before", "because", "although"];

/* F–6 "I can" progression, aligned to CurricHub writing through lines */
const PROGRESSION = {
  "Sentence Fluency": [
    { level: "F–1", ican: "I can write a simple sentence with one red subject and one green verb." },
    { level: "1–2", ican: "I can join two ideas with an ABOY to make a compound sentence — a Santa clause on each side." },
    { level: "2–3", ican: "I can make my subject and verb agree (the dog runs / the dogs run)." },
    { level: "3–4", ican: "I can use a dependent conjunction to write a complex sentence showing time or cause." },
    { level: "4–5", ican: "I can start a sentence with a dependent clause and punctuate it with a comma." },
    { level: "5–6", ican: "I can write compound-complex sentences, choosing structure for effect." },
  ],
  "Word Choice": [
    { level: "F–1", ican: "I can extend a noun group with an adjective (the tall tree)." },
    { level: "1–2", ican: "I can extend a verb group and add an adverb (ran quickly)." },
    { level: "2–3", ican: "I can use modal verbs to show possibility (might, could, must)." },
    { level: "3–4", ican: "I can add adverbial groups to say how, when and where." },
    { level: "4–5", ican: "I can build expanded noun groups (the old wooden bridge by the river)." },
    { level: "5–6", ican: "I can use nominalisation to turn actions into ideas (decide → decision)." },
  ],
};

/* ---------- CARS & STARS ↔ VC2.0 ↔ F&P ↔ PM correlation ---------- */
const LEVEL_COL = {
  0: { main: "#D9C58C", soft: "#FBF6E7", line: "#EBDFBA", text: "#8A6D1F" },
  1: { main: "#EC4899", soft: "#FDF2F8", line: "#FBCFE8", text: "#BE185D" },
  2: { main: "#EF4444", soft: "#FEF2F2", line: "#FECACA", text: "#B91C1C" },
  3: { main: "#F97316", soft: "#FFF7ED", line: "#FED7AA", text: "#C2410C" },
  4: { main: "#EAB308", soft: "#FEFCE8", line: "#FDE68A", text: "#A16207" },
  5: { main: "#22C55E", soft: "#F0FDF4", line: "#BBF7D0", text: "#15803D" },
  6: { main: "#3B82F6", soft: "#EFF6FF", line: "#BFDBFE", text: "#1D4ED8" },
  7: { main: "#6366F1", soft: "#EEF2FF", line: "#C7D2FE", text: "#4338CA" },
  8: { main: "#14B8A6", soft: "#F0FDFA", line: "#99F6E4", text: "#0F766E" },
};
/* CPS colour names A(Pink)→H(Teal); correlate-only F&P/PM as legacy reference */
const CORRELATION = [
  { cars: "AA", cpsColour: "—", vc: "Foundation", vcLevel: 0, fp: "A–B", pm: "1–2", demands: "Single-word / caption texts, strong picture support, repeated pattern." },
  { cars: "A", cpsColour: "Pink", vc: "Foundation–1.0", vcLevel: 1, fp: "C–D", pm: "3–5", demands: "1–2 line sentences, predictable structure, high-frequency words." },
  { cars: "B", cpsColour: "Red", vc: "1.0–2.0", vcLevel: 2, fp: "E–G", pm: "6–9", demands: "Short simple sentences, some dialogue, familiar vocabulary." },
  { cars: "C", cpsColour: "Orange", vc: "2.0", vcLevel: 3, fp: "H–J", pm: "10–13", demands: "Compound sentences, growing vocabulary, less picture reliance." },
  { cars: "D", cpsColour: "Yellow", vc: "3.0–4.0", vcLevel: 4, fp: "K–M", pm: "14–19", demands: "Longer sentences, some complex; inference begins; paragraphs." },
  { cars: "E", cpsColour: "Green", vc: "4.0", vcLevel: 5, fp: "N–P", pm: "20–24", demands: "Complex sentences, subject-specific vocabulary, multi-paragraph." },
  { cars: "F", cpsColour: "Blue", vc: "4.0–5.0", vcLevel: 6, fp: "Q–S", pm: "25–28", demands: "Figurative language, varied structure, sustained inference." },
  { cars: "G", cpsColour: "Indigo", vc: "5.0–6.0", vcLevel: 7, fp: "T–V", pm: "29–30", demands: "Abstract themes, dense information, nuanced author purpose." },
  { cars: "H", cpsColour: "Teal", vc: "6.0+", vcLevel: 8, fp: "W–Y", pm: "30+", demands: "Sophisticated syntax, technical/academic vocabulary, critical reading." },
];

const TEXT_TYPES = ["Narrative", "Information report", "Persuasive", "Recount", "Procedure", "Explanation", "Travel brochure", "Poem", "Letter"];
const STORAGE = "i3s-literacy-hub-v1";

/* ---------- API ---------- */
async function askClaude(messages, maxTokens = 3000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
const parseJSON = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());

/* ---------- annotated sentence renderer ----------
   segments: [{text, part}] where part is an SS key or "plain" */
function AnnotatedText({ segments }) {
  if (!segments?.length) return <span style={{ color: T.faint }}>—</span>;
  return (
    <span style={{ lineHeight: 2, fontSize: 15 }}>
      {segments.map((seg, i) =>
        seg.part && seg.part !== "plain"
          ? <span key={i} style={partStyle(seg.part)}>{seg.text}</span>
          : <span key={i}>{seg.text}</span>
      )}
    </span>
  );
}

/* ============================================================ */
export default function App() {
  const [view, setView] = useState("sentence");

  const VIEWS = [["sentence", "Sentence Science"], ["correlation", "Correlation Table"], ["generator", "Levelled Texts"]];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: F.body, color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { border-color: ${T.blueLine} !important; box-shadow: 0 0 0 3px ${T.blueSoft}; }
        button:hover { filter: brightness(.985); }
      `}</style>

      <div style={{ background: T.card, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={S.eyebrow}>CPS · Literacy · Standalone Tool</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", margin: "12px 0 6px" }}>Literacy Hub</h1>
              <div style={{ color: T.sub, fontSize: 13.5, maxWidth: 640 }}>
                Sentence Science's colour system and F–6 progression in one place, the CARS &amp; STARS ↔ VC2.0 ↔ F&amp;P ↔ PM correlation as a single source of truth, and a levelled-text generator that annotates its mentor texts in CPS colours.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {VIEWS.map(([k, label]) => (<button key={k} onClick={() => setView(k)} style={{ ...S.btnGhost, ...(view === k ? { background: T.ink, color: "#FFF", borderColor: T.ink } : {}) }}>{label}</button>))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px 60px" }}>
        {view === "sentence" && <SentenceScience />}
        {view === "correlation" && <Correlation />}
        {view === "generator" && <Generator />}
      </div>
    </div>
  );
}

/* ============================================================ Sentence Science */
function SentenceScience() {
  const [text, setText] = useState("The tired explorer packed her bag, so she could leave before dawn.");
  const [busy, setBusy] = useState(false);
  const [segments, setSegments] = useState(null);
  const [error, setError] = useState("");
  const [imposters, setImposters] = useState([]);

  async function annotate() {
    setBusy(true); setError(""); setSegments(null); setImposters([]);
    try {
      const prompt = `Colour-code this sentence for a primary "Sentence Science" grammar lesson. Break it into ordered segments covering the WHOLE sentence (including spaces and punctuation). For each segment give a "part":
- "subject" (red) — the main-clause subject noun group
- "verb" (green) — the verb group
- "object" (orange) — the object / complement
- "conj" (violet) — a coordinating (ABOYS: and/but/or/yet/so) or dependent (if/since/when/after/until/as/while/before/because/although) conjunction
- "adverbial" (cyan) — adverbial groups (how/when/where)
- "plain" — articles, spaces, punctuation, and anything not classified

Also flag "imposters": any "and" that is NOT joining two main clauses (so it isn't a true ABOY).

Output ONLY JSON:
{"segments":[{"text":"","part":"subject|verb|object|conj|adverbial|plain"}],"imposters":["short reason for each imposter, or empty array"]}

SENTENCE: ${JSON.stringify(text)}`;
      const data = parseJSON(await askClaude([{ role: "user", content: prompt }], 2000));
      // guard: segments must reconstruct the text; if not, fall back to plain
      setSegments(data.segments || [{ text, part: "plain" }]);
      setImposters(data.imposters || []);
    } catch (e) { setError(`Couldn't annotate — ${e.message || e}`); }
    setBusy(false);
  }

  return (
    <>
      <Section eyebrow="Live annotator" title="Colour-code a sentence"
        right={<button style={S.btn} disabled={busy || !text.trim()} onClick={annotate}>{busy ? "Marking up…" : "Annotate"}</button>}>
        <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 10 }}>Type a mentor sentence and mark it up in the CPS colours — red subject, green verb group, orange object, violet conjunction. Imposter "and"s are flagged.</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ ...S.input, minHeight: 70, resize: "vertical", fontSize: 15 }} />
        {error && <div style={{ marginTop: 8 }}><Pill tone="red" style={{ fontSize: 11.5 }}>{error}</Pill></div>}
        {segments && (
          <div style={{ marginTop: 14, padding: "16px 18px", border: `1px solid ${T.line}`, borderRadius: 14, background: "#FCFDFE" }}>
            <AnnotatedText segments={segments} />
            {imposters.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px dashed ${T.line}`, paddingTop: 10 }}>
                <div style={{ ...S.eyebrow, color: T.amber, marginBottom: 4 }}>Imposters spotted</div>
                {imposters.map((im, i) => <div key={i} style={{ fontSize: 12.5, color: T.amber }}>◦ {im}</div>)}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {SS_ORDER.map((k) => (
            <span key={k} style={{ ...S.pill, fontSize: 11.5, background: SS[k].soft, borderColor: SS[k].line, color: SS[k].ink }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: SS[k].color, display: "inline-block" }} />{SS[k].name}
            </span>
          ))}
        </div>
      </Section>

      <Section eyebrow="Compound anchor" title="ABOYS — the reindeer & Santa clauses">
        <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>
          Coordinating conjunctions join two <b>main clauses</b> — each a "Santa clause" with one <span style={{ ...partStyle("subject") }}>red subject</span> and one <span style={{ ...partStyle("verb") }}>green verb</span>. An "and" that isn't joining two main clauses is an <b>imposter</b>.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {ABOYS.map((a) => (
            <div key={a.word} style={{ border: `1px solid ${SS.conj.line}`, borderRadius: 12, padding: 12, background: SS.conj.soft }}>
              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 20, color: SS.conj.ink }}>{a.word}</div>
              <div style={{ fontSize: 12.5, color: SS.conj.ink, marginTop: 2 }}>{a.reindeer}</div>
              <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Complex sentences" title="Dependent conjunctions">
        <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 12 }}>Held separately from the ABOYS — these open a dependent clause for time and causality.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DEPENDENTS.map((d) => <span key={d} style={{ ...S.pill, background: SS.adverbial.soft, borderColor: SS.adverbial.line, color: SS.adverbial.ink, fontSize: 13 }}>{d}</span>)}
        </div>
      </Section>

      <Section eyebrow="F–6 scope & sequence" title='"I can…" progression'>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {Object.entries(PROGRESSION).map(([strand, rows]) => (
            <div key={strand}>
              <div style={{ ...S.eyebrow, marginBottom: 8 }}>{strand}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "baseline" }}>
                    <Pill tone="blue" style={{ fontSize: 10.5, padding: "3px 9px" }}>{r.level}</Pill>
                    <span style={{ fontSize: 12.5 }}>{r.ican || r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ color: T.faint, fontSize: 11.5, marginTop: 10 }}>
          Because these structures <i>are</i> the writing through lines (Sentence Fluency, Word Choice), they inherit the same chunking and SOLO tiering as any other focus — the hub isn't a separate silo.
        </div>
      </Section>
    </>
  );
}

/* ============================================================ Correlation */
function Correlation() {
  return (
    <>
      <Section eyebrow="Single source of truth" title="Reading level correlation">
        <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 6 }}>
          CPS uses the CARS &amp; STARS <b>levels, strategy set and tracking</b> against our own explored texts — <b>not</b> the program. VC2.0 is the assigned level; F&amp;P and PM are <b>correlate-only, legacy reference</b>.
        </div>
        <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 14, background: T.card, marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
            <thead>
              <tr>
                {["CARS & STARS", "CPS colour", "VC2.0", "F&P", "PM", "Language demands at this band"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {CORRELATION.map((r) => {
                const c = LEVEL_COL[r.vcLevel];
                return (
                  <tr key={r.cars}>
                    <td style={{ ...tdStyle, fontWeight: 800, fontFamily: F.display, background: c.soft, color: c.text, borderLeft: `4px solid ${c.main}` }}>{r.cars}</td>
                    <td style={tdStyle}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: c.main, display: "inline-block" }} />{r.cpsColour}</span></td>
                    <td style={tdStyle}>{r.vc}</td>
                    <td style={{ ...tdStyle, color: T.faint }}>{r.fp}</td>
                    <td style={{ ...tdStyle, color: T.faint }}>{r.pm}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{r.demands}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ color: T.faint, fontSize: 11.5, marginTop: 10 }}>Level journey: Read Aloud → Pre → Benchmark → Post, colour-coded A (Pink) through H (Teal). Prep/Yr1 use decodables + PM benchmark texts.</div>
      </Section>
    </>
  );
}

/* ============================================================ Levelled text generator */
function Generator() {
  const [system, setSystem] = useState("cars"); // cars | vc
  const [carsLevel, setCarsLevel] = useState("D");
  const [vcLevel, setVcLevel] = useState(4);
  const [textType, setTextType] = useState("Narrative");
  const [lens, setLens] = useState("");
  const [words, setWords] = useState(120);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null); // {text, segments}
  const [error, setError] = useState("");

  const band = system === "cars"
    ? CORRELATION.find((r) => r.cars === carsLevel)
    : CORRELATION.find((r) => r.vcLevel === Number(vcLevel));

  async function generate(reLevelDir) {
    setBusy(true); setError("");
    try {
      const targetCars = system === "cars" ? carsLevel : band?.cars;
      const demands = band?.demands || "";
      const base = out?.text;
      const task = reLevelDir
        ? `Re-level the text below ${reLevelDir === "up" ? "UP one band (harder)" : "DOWN one band (easier)"}, keeping the same content and text type. Target CARS & STARS level ${targetCars} (VC2.0 ${band?.vc}). Language demands: ${demands}. About ${words} words.\n\nTEXT:\n${base}`
        : `Write an original ${textType.toLowerCase()} for a Victorian primary classroom${lens ? ` about: ${lens}` : ""}.
Pitch it precisely at CARS & STARS level ${targetCars} (VC2.0 ${band?.vc}). Honour these language demands for the band: ${demands}. About ${words} words. Age-appropriate, engaging, correct.`;
      const prompt = `${task}

Then colour-code the FIRST 2–3 sentences for a Sentence Science mini lesson (segments covering the whole span; parts: subject|verb|object|conj|adverbial|plain).

Output ONLY JSON:
{"text":"the full text","annotatedSpan":[{"text":"","part":"subject|verb|object|conj|adverbial|plain"}]}`;
      const data = parseJSON(await askClaude([{ role: "user", content: prompt }], 3500));
      setOut({ text: data.text || "", segments: data.annotatedSpan || [] });
    } catch (e) { setError(`Generation failed — ${e.message || e}`); }
    setBusy(false);
  }

  return (
    <>
      <Section eyebrow="Any text type, any level" title="Levelled text generator"
        right={<button style={S.btn} disabled={busy} onClick={() => generate(null)}>{busy ? "Writing…" : "Generate text"}</button>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={{ ...S.btnGhost, ...(system === "cars" ? { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep } : {}) }} onClick={() => setSystem("cars")}>CARS &amp; STARS level</button>
          <button style={{ ...S.btnGhost, ...(system === "vc" ? { background: T.blueSoft, borderColor: T.blueLine, color: T.blueDeep } : {}) }} onClick={() => setSystem("vc")}>VC2.0 level</button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {system === "cars" ? (
            <Field label="CARS & STARS level"><select value={carsLevel} onChange={(e) => setCarsLevel(e.target.value)} style={{ ...S.input, width: 90 }}>{CORRELATION.map((r) => <option key={r.cars}>{r.cars}</option>)}</select></Field>
          ) : (
            <Field label="VC2.0 level"><select value={vcLevel} onChange={(e) => setVcLevel(Number(e.target.value))} style={{ ...S.input, width: 130 }}>{CORRELATION.map((r) => <option key={r.vcLevel} value={r.vcLevel}>{r.vcLevel === 0 ? "Foundation" : `Level ${r.vcLevel}`}</option>)}</select></Field>
          )}
          <Field label="Text type"><select value={textType} onChange={(e) => setTextType(e.target.value)} style={{ ...S.input, width: 180 }}>{TEXT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Approx words"><input type="number" min={30} max={400} step={10} value={words} onChange={(e) => setWords(Math.max(30, Number(e.target.value) || 30))} style={{ ...S.input, width: 90 }} /></Field>
        </div>
        <Field label="Lens / subject / description (optional)" style={{ marginTop: 12 }}>
          <input value={lens} onChange={(e) => setLens(e.target.value)} placeholder="e.g. a travel brochure for a Pacific island · the water cycle · a persuasive letter about screen time" style={S.input} />
        </Field>
        {band && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...S.pill, fontSize: 11, background: LEVEL_COL[band.vcLevel].soft, borderColor: LEVEL_COL[band.vcLevel].line, color: LEVEL_COL[band.vcLevel].text }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: LEVEL_COL[band.vcLevel].main }} />CARS {band.cars} · {band.cpsColour} · VC {band.vc}
            </span>
            <span style={{ fontSize: 11.5, color: T.sub }}>{band.demands}</span>
            <span style={{ fontSize: 11, color: T.faint }}>F&amp;P {band.fp} · PM {band.pm} (correlate-only)</span>
          </div>
        )}
        {error && <div style={{ marginTop: 10 }}><Pill tone="red" style={{ fontSize: 11.5 }}>{error}</Pill></div>}
      </Section>

      {out && (
        <Section eyebrow="Mentor text" title={`${textType} · ${band?.cars} (${band?.cpsColour})`}
          right={<>
            <button style={S.btnGhost} disabled={busy} onClick={() => generate("down")}>Re-level ↓ easier</button>
            <button style={S.btnGhost} disabled={busy} onClick={() => generate("up")}>Re-level ↑ harder</button>
            <button style={S.btnGhost} onClick={() => navigator.clipboard?.writeText(out.text)}>Copy text</button>
          </>}>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.7, padding: "14px 16px", border: `1px solid ${T.line}`, borderRadius: 14, background: "#FCFDFE", marginBottom: 14 }}>{out.text}</div>
          {out.segments?.length > 0 && (
            <div>
              <div style={{ ...S.eyebrow, marginBottom: 8 }}>Sentence Science mark-up — opening sentences</div>
              <div style={{ padding: "14px 16px", border: `1px solid ${T.line}`, borderRadius: 14, background: "#fff" }}>
                <AnnotatedText segments={out.segments} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {SS_ORDER.slice(0, 5).map((k) => (
                  <span key={k} style={{ ...S.pill, fontSize: 10.5, background: SS[k].soft, borderColor: SS[k].line, color: SS[k].ink }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: SS[k].color, display: "inline-block" }} />{SS[k].name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}
    </>
  );
}

const thStyle = { padding: "10px 12px", textAlign: "left", fontFamily: F.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint, borderBottom: `1px solid ${T.line}`, background: "#FAFBFD" };
const tdStyle = { padding: "9px 12px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5, verticalAlign: "top" };
