# RuralCare – Centralized Medical Records Platform

React (Vite) frontend + Node/Express + MongoDB backend. JWT authentication, patient and doctor roles.

## Run it
```bash
# 1. MongoDB must be running (local or Atlas)
cp server/.env.example server/.env      # then set JWT_SECRET (and MONGO_URI if needed)
npm run install:all
npm run server                          # API on http://localhost:5000
npm run client                          # App on http://localhost:5173  (proxies /api to :5000)
```
Create a **doctor** account first, then a **patient** account. The patient books an appointment with the doctor;
that is what links them (a doctor can only open patients who have booked with them).

## What is real (backed by the API/database)
Register / login / profile edit · appointments (patient books, doctor creates, confirm, decline, reschedule, cancel, complete) ·
medical records and uploaded medical reports (PDF / JPG / PNG, added by doctors) · prescriptions (multi-medicine drafts, doctor approval, revisions with history, PDF) ·
doctor-patient messages (refreshes every 8 s) · patient search · dashboard counts · notification bell (unread messages, pending requests).
No demo or seed data is created. Anything without data shows an empty state or "No data available".

## Honest gaps (not faked)
| Wish | Status |
|---|---|
| Heart rate / BP / weight / health status | Not a separate system. Doctors may enter them optionally on a medical record; the dashboard shows the latest entered values, otherwise "No data available". |
| Sign in with voice | Not possible securely. The login page lets you *speak your email/phone*; the password is always typed. |
| Forgot password | No reset flow exists yet. The link says so. |
| Doctor verification | Not implemented. Anyone can register as a doctor, but can only see patients who booked with them. Add admin approval before real use. |
| Chat attachments | Still disabled (report storage now exists, chat attachments are not wired to it). |
| Real-time chat | Uses polling, not WebSockets. |
| Security claims | UI says "protected" only. No compliance certifications are claimed. Add HTTPS, rate limiting and audit logs for production. |
| Voice assistant | Uses the browser Web Speech API (best in Chrome/Edge). Tamil/Hindi recognition depends on the device. Command buttons work without a microphone. |

## Structure
```
server/src  models/ routes/ middleware/ lib/ index.js
client/src  pages/ components/ (Shell, ui, Clinical, VoicePanel) styles.css api.js auth.jsx
```

## Medical report upload (doctor → patient)
1. Doctor opens **Patients → Upload Report** (or opens a patient → **Upload Medical Report** / **Medical History → Add Medical Record**).
2. Fills in title, report type, test date, diagnosis, results, notes, optional measurements, and attaches a PDF/JPG/PNG (max 10 MB).
3. The details are saved in MongoDB (`MedicalRecord`), then the file is uploaded with a progress bar. If the upload fails the record is rolled back.
4. The patient sees it immediately under **Medical Records** (search, type filter, newest/oldest) and can **Open** or **Download** the file.

**Security model**
- Files are stored on the server's private disk (`REPORTS_DIR`, default `server/storage/reports`, git-ignored, mode 0600) under random names. They are **never** served as static files.
- `GET /api/records/:id/file` requires a valid token and checks on every request that the caller is the owning patient, or a doctor linked to that patient. Anything else gets a generic 404. The browser fetches the file with the token in a header and opens it from a temporary blob URL, so there is no shareable link.
- Upload is restricted to doctors, and only the doctor who created the record can attach or replace its file. The file type is verified from the file's real bytes (not its name or claimed type); only PDF, JPEG and PNG pass. Size is capped by `MAX_REPORT_MB`.
- The internal storage key is never returned by the API.
- Back up `REPORTS_DIR` together with MongoDB. Behind a reverse proxy (nginx etc.) raise the request body limit to at least the upload size (`client_max_body_size 12m;`).

A doctor can open a patient's records only if the patient booked with them, or the patient accepted an appointment the doctor created.

## Theme
The UI uses a single coral & cream design system defined as CSS variables at the top of `client/src/styles.css`
(`--coral`, `--bg`, `--card`, `--border`, …). Change a token there to re-theme the whole app.
`components/Illustration.jsx` holds the SVG artwork. Animations respect `prefers-reduced-motion`.

## Appointments (kept in sync between both accounts)
- One MongoDB record per appointment. Doctor and patient changes update that same record, so both accounts always show the same date, time and status. Open pages refresh automatically every 15–30 s and when you return to the tab.
- Times are stored as exact UTC instants. The browser converts the local date + time you pick, so both accounts agree on the moment in their own timezone.
- Double-booking is blocked: a doctor (or patient) cannot have two live appointments within 30 minutes, checked in the API and backed by unique database indexes.
- A doctor can create an appointment for a patient. If the patient has seen that doctor before it is confirmed straight away; otherwise it waits for the patient to **Accept**, and until then it gives the doctor **no access** to the patient's records.
- A doctor's reschedule is final (patient sees it immediately). A patient's reschedule goes back to *Pending* for the doctor to confirm. Every change is kept in the appointment's `history`.

## Prescriptions
- Doctor: **Prescriptions** in the sidebar (or a patient's page → Prescriptions) → *New prescription*. Choose patient and optionally one of their appointments; add diagnosis, clinical notes, any number of medicines (name, dosage, route, frequency, duration, instructions) and a follow-up date.
- New prescriptions are **drafts**: only the prescribing doctor can see them. Publishing needs the doctor's explicit approval (a checkbox in the editor or the *Review & publish* dialog; the API refuses without `confirm: true`), and every medicine must then be complete.
- A published prescription can be **revised**; the earlier version is stored in its history and the version number goes up. Published prescriptions cannot be deleted; drafts can.
- The patient sees only their own published prescriptions and can **view/download a PDF**. PDFs exist only for published prescriptions and only the patient and the prescribing doctor can fetch them. Prescriptions created before this update stay visible as published.
- PDFs use the built-in Helvetica font, so names in non-Latin scripts (Tamil, Hindi…) print as `?`. Use a PDF library with an embedded Unicode font if you need them.

## Tests
`cd server && npm test` runs dependency-free logic tests of the real route code (authorization, validation, appointment sync, prescription workflow, uploads) against an in-memory stand-in for MongoDB. They do **not** replace trying the app against a real database.

## Security notes
JWT secret strength is checked at start-up (fatal in production). Tokens are re-checked against the database on every request. Login is rate-limited (10/15 min per IP + account). Inputs are type-checked server-side and malformed IDs return 400/404 instead of 500. Still to do before real patient data: HTTPS, audit logging, backups, a doctor-verification step, and a shared rate-limit store if you run more than one server.

## Doctor: Medical Records page
Sidebar → **Medical Records** (`/medical-records`). It lists every record the logged-in doctor has written, with the connected patients on top, search, filters (patient, report type, test-date range), and View / Download / Edit / Delete per row (a table on desktop, cards on mobile).
*Upload Medical Record* asks for patient, title, report type (Blood Test, Blood Sugar, Blood Pressure, X-ray, Scan, ECG, Lab Report, Other), test date, description / clinical notes and the file (PDF/JPG/PNG, max 10 MB — required here). There is one record per report: the patient sees that same record in **Medical Records**, and open pages refresh automatically.
Deleting needs a confirmation tick and only the doctor who created the record can do it. Older records with other types (urine test, prescription, general) still display; they are just no longer offered for new records.
