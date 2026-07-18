# RANGES Athlete Wellness & Load Monitoring — Setup Guide

A mobile-friendly web app that replaces the Google Form. Athletes check in after
every practice & game; the Wellness Coordinator sees the whole team over time and
is **emailed automatically** the moment an athlete's answers show a negative
change from their own baseline.

**Four roles, four levels of access:**

| Role | PIN (default) | Sees |
|---|---|---|
| Athlete | none | Their own check-ins & trends only |
| Wellbeing (wellness coordinator) | `1111` | ALL athlete data: trends over time, team snapshot, alerts, CSV export |
| Coach | `2222` | Notifications only — athletes who asked to chat with the coach. No scores or trends. |
| Admin | `9999` | Setup only — questions, roster, rules, PINs. **No athlete data.** |

**Files**

| File | What it is |
|---|---|
| `ranges-wellness.html` | The whole app (athlete + wellbeing + coach + admin screens) |
| `ranges-wellness-apps-script.gs` | Google Apps Script backend (shared data + automatic emails) |
| `RANGES_Wellness_Setup.md` | This guide |

---

## 1. Put the app online (5 min)

Any static host works. Easiest with this GitHub repo:

1. GitHub repo → **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)` → **Save**.
2. Your app will be live at
   `https://<your-username>.github.io/i3s-classroom/ranges-wellness.html`
3. Share that link with athletes and coaches.

> The app also works opened as a plain local file, but a hosted link is what
> athletes save to their phones.

## 2. Create the Google Sheet backend (10 min)

This makes data shared across all devices **and turns on automatic alert emails**.
Without it, the app still works, but data stays on each individual device.

1. Go to [sheets.google.com](https://sheets.google.com) → new blank spreadsheet.
   Name it e.g. `RANGES Wellness Data`.
2. **Extensions → Apps Script**. Delete the placeholder code.
3. Copy the entire contents of `ranges-wellness-apps-script.gs` and paste it in. **Save**.
4. **Deploy → New deployment** → gear icon → **Web app**:
   - Description: `ranges wellness`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorise with your Google account (it will warn the app is
   unverified — Advanced → Go to project → Allow. It's your own script).
6. Copy the **Web app URL** (ends in `/exec`).

> Alert emails are sent from the Google account that deploys the script.
> Consider deploying from a club account rather than a personal one.

## 3. Configure the app (5 min)

1. Open the app → **Admin** (default PIN `9999`).
2. (Optional) Edit the **check-in questions** — add, remove, reorder or reword
   any question and its five answers. Every question keeps a 1→5 scale
   (1 = best) so trends and baseline alerts keep working. The communication
   question's wording and routing (who gets alerted per option) is editable too.
3. If using sync: paste the Web app URL into **Google Sheets sync** → **Test connection**.
4. Fill in **People & notifications**: Wellness Coordinator name + email
   (Melissa), head coach email.
5. Add the **athlete roster** (User ID + name for each athlete).
6. Change the three PINs: Wellbeing (default `1111`), Coach (default `2222`),
   Admin (default `9999`).
7. **Save all settings.** With sync on, settings, questions and roster sync to
   the sheet, so every device picks them up.

## 4. Athletes (1 min each, once)

1. Open the shared link on their phone.
2. Save to home screen — iPhone: Share → *Add to Home Screen*; Android: menu ⋮ → *Add to Home Screen*.
3. Tap **Athlete**, enter their User ID (age group + initials, e.g. `19TS`) and first name.
4. Done — **the device remembers them**. From now on it's: tap icon → check in.
   They only re-enter the ID if they get a new phone.

---

## How the alerts work

Alerts compare each athlete to **their own baseline** (their average score in
each wellness area from previous check-ins) — not to fixed numbers. A naturally
sore athlete doesn't cause false alarms; a decline in a usually-fresh athlete
is caught early. Scores run 1 (best) → 5 (worst).

| Severity | Fires when | Default |
|---|---|---|
| **Red** | Massive negative change within **1–2 sessions** vs baseline | one session +3.0 worse, or two in a row each +2.5 worse |
| **Yellow** | Gradual change: one week's average notably worse, **or** two consecutive weeks each somewhat worse than baseline | +1.5 in a week / +0.75 two weeks running |
| **Chat request** | Athlete picks any "I'd like to chat…" option on the communication question | immediate, always |

- Baselines activate after a minimum number of check-ins (default 4). Until
  then only chat requests alert.
- All thresholds are adjustable in **Admin → Alert rules**.
- Optional extras: red alert on any single 5/5; include session RPE (training
  load) in baseline alerts.

**When a rule trips:** the alert appears on the wellbeing screen, and — with
sync connected — the Apps Script **emails the Wellness Coordinator immediately**,
automatically, with severity, athlete, and detail. Chat requests routed to
"coach + wellbeing" also email the coach directly and appear on the coach's
notification screen. Each
alert is emailed only once (deduped in the `Alerts` sheet). Coaches mark
alerts **Actioned** in the app to clear them; the actioned list syncs to
every device.

## What's in the sheet

| Tab | Contents |
|---|---|
| `Checkins` | One row per check-in (id, date, athlete, full answers as JSON) |
| `Shared` | Config, roster, actioned-alerts list |
| `Alerts` | Log of every alert emailed (also the dedupe record) |

The wellbeing screen can also export everything as CSV at any time.

## Everyday use

- **Athletes**: tap the home-screen icon after every practice & game → a few quick
  taps → done. They see their own trends, readiness score and streak.
- **Wellbeing** (PIN): team wellbeing over time, team snapshot with this week's
  scores and ▲▼ change vs each athlete's baseline, readiness, weekly training
  load (RPE), who hasn't checked in, the alerts feed, and CSV export. Tap any
  athlete for full trend charts.
- **Coach** (PIN): a single notifications screen — athletes who chose a
  communication option involving the coach. No wellness data.
- **Admin** (PIN): questions, roster, alert rules, PINs, sync, demo data. No
  athlete data by design.

## Troubleshooting

- **"Could not connect"** on Test connection → re-check you deployed as
  *Web app*, access *Anyone*, and copied the `/exec` URL (not the editor URL).
- **Changed the script?** → Deploy → *Manage deployments* → edit → new version.
  The URL stays the same.
- **No emails arriving** → coordinator email must be filled in under Admin →
  People, and settings saved *after* sync was connected. Check the `Alerts`
  tab — if rows appear there, the flag fired; check spam.
- **Athlete got a new phone** → open the link, tap Athlete, enter the same
  User ID — history reconnects automatically (it lives in the sheet).
