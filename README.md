# Felicity Event Management System — 2024117010

A full-stack event management system for IIIT Hyderabad's annual techno-cultural fest **Felicity**, built with the MERN stack.

---

## Table of Contents

1. [Tech Stack & Libraries — Justification](#tech-stack--libraries)
2. [Advanced Features (Tier A / B / C)](#advanced-features)
3. [Setup & Installation](#setup--installation)
4. [Demo Credentials](#demo-credentials)
5. [Project Structure](#project-structure)

---

## Tech Stack & Libraries

### Frontend

| Library / Framework | Version | Why chosen |
|---|---|---|
| **React 19** (via Vite) | ^19.2.0 | Component-based UI architecture. React 19 adds built-in transitions and improved concurrent rendering. Vite provides near-instant HMR and ES-module-first bundling, massively reducing feedback loop during development. |
| **react-router-dom v7** | ^7.13.0 | Declarative client-side routing between pages (landing, login, events, dashboard, etc.). v7 ships improved data APIs and nested route support allowing protected-route composition with minimal boilerplate. |
```

### Deploying to Vercel

Set the following secrets in your Vercel project (or in GitHub Actions):

- `VERCEL_TOKEN` — your personal Vercel token
- `VERCEL_ORG_ID` — your Vercel organization id (optional; helpful in CI)
- `VERCEL_PROJECT_ID` — your Vercel project id (optional; helpful in CI)

Quick manual deploy via Vercel CLI:

```bash
# Install CLI (one-time)
npm install -g vercel

# Login
vercel login

# From the repository root
vercel --prod --confirm
```

Or use the included GitHub Actions workflow which deploys on push to `main`/`master`: `.github/workflows/deploy-vercel.yml`.

Make sure to set the frontend environment variable `VITE_API_URL` to `https://felicity-backend-api.onrender.com/api` in the Vercel dashboard (Environment > Production) so the app points to the correct backend.

| **axios** | ^1.13.4 | Promise-based HTTP client with interceptors. Used for a centralised API client (`src/services/api.js`) that automatically attaches JWT Bearer tokens and handles 401 auto-logout — impossible to do cleanly with the native `fetch` API without custom wrappers. |
| **react-hot-toast** | ^2.6.0 | Lightweight, accessible toast notification library (< 5 kB). Chosen over heavier alternatives (react-toastify) because it requires zero global configuration, supports custom styles and positions, and integrates with CSS variables for dark-mode. |
| **react-icons** | ^5.5.0 | Tree-shakeable SVG icon set covering FontAwesome, Material, Heroicons in a single package. Avoids icon-font loading overhead and keeps bundle size small by importing only used icons. |
| **jsqr** | ^1.4.0 | Pure-JavaScript QR code decoder running in the browser. Used by the organiser QR-scanner feature to decode participant ticket QR codes from the camera/canvas without any native plugin dependency. |
| **tailwindcss** | ^4.1.18 (dev) | Utility-first CSS framework used for rapid UI composition and responsive layouts alongside the project's custom `index.css`. Chosen for its minimal runtime footprint (only used classes in output) and strong ecosystem. |
| **Vite / rolldown-vite** | 7.2.5 | Build tooling. rolldown-vite is a Rust-native drop-in replacement for the Vite bundler that provides faster cold starts and builds while remaining API-compatible. |

### Backend

| Library / Framework | Version | Why chosen |
|---|---|---|
| **Node.js + Express 5** | ^5.2.1 | Minimal, un-opinionated REST API framework. Express 5 adds native async/await error propagation (no need for try-catch in every route), making error handling cleaner when combined with the custom `asyncHandler` wrapper. |
| **MongoDB + Mongoose 9** | ^9.1.5 | Document-oriented database fits the varied and schema-flexible nature of event data (custom form fields, merchandise variants). Mongoose adds schema validation, `pre`/`post` middleware hooks (used for password hashing and registration count updates), and virtual fields. |
| **jsonwebtoken** | ^9.0.3 | Stateless JWT auth. Tokens encode the user ID and are signed with `JWT_SECRET`. Role-based route protection is enforced in `middleware/auth.js` without server-side sessions, making the API horizontally scalable. |
| **bcryptjs** | ^3.0.3 | Secure password hashing with configurable salt rounds. Pure-JS implementation (no native bindings) so it works without compilation on all platforms. |
| **nodemailer** | ^7.0.13 | Full-featured SMTP email client supporting connection pooling, TLS, and multiple transports. Supports an Ethereal SMTP fallback for development (no credentials needed) that logs a preview URL to the console. |
| **multer** | ^2.0.2 | Multipart form-data middleware for handling file uploads (payment proof images, event banners). Configured with file-type filtering and size limits in `middleware/upload.js`. |
| **qrcode** | ^1.5.4 | Generates QR code data URLs embedded into registration confirmation emails and ticket pages. |
| **svg-captcha** | ^1.4.0 | Generates SVG CAPTCHA challenges for registration and login to prevent automated abuse, without third-party CAPTCHA services (no external API key required). |
| **uuid** | ^13.0.0 | Generates collision-resistant unique IDs for ticket references, email queue entries, and file names. |
| **cors** | ^2.8.6 | Configures cross-origin headers so the frontend (different port/domain) can call the backend API. |
| **dotenv** | ^17.2.3 | Loads environment variables from `.env` files so secrets (DB URI, SMTP credentials, JWT secret) stay out of source code. |
| **express-validator** | ^7.3.1 | Request validation middleware providing declarative input sanitisation and error collection for API endpoints. |
| **nodemon** | ^3.1.11 (dev) | Auto-restarts the Node server when source files change during development, eliminating manual restarts. |

---

## Advanced Features

### Tier A — Merchandise Payment Approval Workflow + QR Attendance Scanner

**Why chosen:** Payment verification is essential for a real-money event ticketing platform. Combined with QR-based attendance scanning, it covers the full participant lifecycle from purchase to check-in.

**Implementation:**
- Participants upload a payment proof image when purchasing a paid merchandise item (`multer` handles the upload, stored in `backend/uploads/`).
- The organiser sees a "Pending Approval" queue on their dashboard. They can **Approve** (triggers confirmation email with QR ticket) or **Reject** (restores merchandise stock atomically to prevent overselling).
- QR Scanner page (organiser): uses `jsqr` to decode QR data from a canvas frame or pasted data. Marks attendance on the registration record and prevents duplicate scans (duplicate check in `registrationController`). A manual override mode exists for edge cases.
- Attendance dashboard shows real-time counts: total registered, attended, pending.

**Design decisions:**
- Stock restoration on rejection uses a Mongoose `findOneAndUpdate` with `$inc` to prevent race conditions.
- Approval workflow stores a `requiresPaymentApproval` flag on events to conditionally show the upload UI only when needed.

**Implementation details (what to implement / where to look):**

- Backend models & fields:
	- `Registration` / `Order` model: add fields `paymentProofUrl` (string), `paymentStatus` (enum: `pending|approved|rejected|successful`), `approvedBy` (organizer id), `approvedAt` (timestamp), `qrCodeData` (data URL), and `attendance` (object with `scanned: Boolean`, `scannedAt`, `scannedBy`).
	- `Event` model: `requiresPaymentApproval` boolean, stock tracking fields per merchandise variant.

- Backend endpoints (examples):
	- `POST /api/registrations/:id/upload-proof` — multipart form-data upload (image) to attach `paymentProofUrl` and set `paymentStatus = 'pending'`.
	- `GET /api/admin/merch-orders?status=pending` — organiser/admin view listing orders with proof URLs.
	- `POST /api/admin/merch-orders/:id/approve` — approve order: decrement stock atomically, generate QR with `qrcode` library, set `paymentStatus='successful'`, set `qrCodeData`, and send confirmation email via `services/emailService`.
	- `POST /api/admin/merch-orders/:id/reject` — reject order: set `paymentStatus='rejected'`, optionally restore stock if previously reserved.

- File uploads:
	- Use `multer` in `middleware/upload.js` with image file validation and size limits. Store files under `backend/uploads/merch-proofs/` (or GridFS if configured).

- Email & QR:
	- On approval, generate `qrCodeData` using the `qrcode` package (data URL) and embed it into the confirmation email template. `backend/services/emailService.js` already contains helpers — add `sendMerchConfirmationEmail(order)`.

- Frontend UX (minimal flows):
	- After checkout, show an "Upload payment proof" button on the order details page that POSTs the image to `/api/registrations/:id/upload-proof`.
	- Organizer dashboard: new "Payment Approvals" tab listing pending orders with thumbnails of uploaded proofs and Approve/Reject buttons. Approve triggers approval API and shows success toast; Reject opens a modal requiring a reason.

---

### Tier A — QR Scanner & Attendance Tracking (details)

**Implementation details (what to implement / where to look):**

- Backend additions:
	- Endpoint `POST /api/events/:eventId/attendance/scan` accepts a ticket payload (ticket id or QR payload). It validates the registration belongs to the event, checks `attendance.scanned` to prevent duplicates, sets `attendance.scanned = true`, `attendance.scannedAt = Date.now()`, and `attendance.scannedBy` (organizer id). Returns updated attendance status.
	- Endpoint `GET /api/events/:eventId/attendance` returns participant list with attendance status for dashboard and CSV export.
	- Audit log model `AttendanceLog` storing `registrationId`, `scannedAt`, `scannedBy`, `method` (`camera|upload|manual`), and `note` for overrides.

- Frontend components:
	- `QRScanner.jsx` — uses `jsqr` to decode camera frames or uploaded image files. On decode, it POSTs the ticket payload to `/api/events/:eventId/attendance/scan` and displays result (Accepted / Duplicate / Invalid).
	- `AttendanceDashboard.jsx` — shows counts (scanned vs pending), real-time polling (every 3–5s) to refresh, table of participants with export-to-CSV button that calls `GET /api/events/:eventId/attendance?export=csv` (backend streams CSV).
	- Manual override: a button in each participant row allows marking/unmarking attendance; stores an audit `note` and logs the admin user.

---

---

### Tier B — Organiser Password Reset + Event Discussion Forum

**Why chosen:** Password management is unavoidable in multi-role systems. Discussion forums provide real-time community interaction around events, increasing engagement.

**Password Reset (Organiser → Admin flow):**
- Organiser submits a reset request through their dashboard.
- Admin reviews all pending requests on the "Password Requests" page and resets with an auto-generated secure password.
- New credentials are emailed to the organiser via Nodemailer.
- Design: admin-mediated reset (not self-service) because organisers are trusted internal accounts, not public users.

**Event Discussion Forum:**
- Each event has a threaded discussion board accessible to registered participants and the event organiser.
- Features: post messages, **pin** messages (organiser only), emoji reactions, **long-polling** for near-real-time updates (frontend polls `/api/discussions/:eventId` every 5 s).
- Access control: only users with a confirmed registration for that event (or the organiser) can post — enforced server-side in `discussionController`.
- Pinned messages appear at the top regardless of chronological order.

**Implementation details (what to implement / where to look):**

- Organizer Password Reset Workflow:
	- Model: `OrganizerPasswordRequest` with fields: `organizerId`, `clubName`, `reason`, `requestedAt`, `status` (`pending|approved|rejected`), `reviewedBy`, `reviewedAt`, `adminComment`, and `generatedPassword`.
	- Endpoints:
		- `POST /api/admin/password-requests` — create request (organiser-side).
		- `GET /api/admin/password-requests` — list requests for admin with filters by status.
		- `POST /api/admin/password-requests/:id/approve` — admin approves: generate a secure password (use `crypto.randomBytes`), set `generatedPassword` in request record (and optionally send via email to admin), update organiser `password` (hashed) and set request `status='approved'` with audit fields.
		- `POST /api/admin/password-requests/:id/reject` — admin rejects with `adminComment`.
	- Frontend: `PasswordRequestsPage.jsx` (already in `src/pages`) will display requests with Approve / Reject actions and reason/comment modals.

- Real-Time Discussion Forum:
	- Simpler approach (works without socket server): implement polling every 3–5s on the Event Details page and trigger a local notification (react-hot-toast) on new messages for the current event. This reduces infra changes and is resilient behind proxies.
	- API:
		- `GET /api/discussions/:eventId?since=<timestamp>` — returns messages posted since timestamp for incremental updates.
		- `POST /api/discussions/:eventId` — create message (requires registration check on server).
		- `POST /api/discussions/:eventId/:messageId/pin` — organiser-only pin/unpin.
		- `DELETE /api/discussions/:eventId/:messageId` — moderator delete.
		- `POST /api/discussions/:eventId/:messageId/react` — add/remove reactions.
	- Message threading: each message may have `parentId` to represent replies; display uses indentation and collapse for long threads.

---

### Tier C — CAPTCHA & Misc Improvements

**CAPTCHA improvements:**
- The app uses `svg-captcha` to generate lightweight SVG CAPTCHAs. Improve handling by:
	- Increasing randomness parameters (`size`, `noise`, `color`) for production-like difficulty while keeping accessibility in mind.
	- Storing CAPTCHA answers server-side in a short-lived in-memory store keyed by `captchaId` and expire after 5 minutes to avoid replay.
	- On the frontend, ensure `LoginPage.jsx` and `RegisterPage.jsx` fetch a new CAPTCHA (`GET /api/auth/captcha`) on failure and when the user requests a refresh.

**Notes:**
- All added endpoints must include proper access control (`protect` middleware) and role checks (`authorize('organizer'|'admin')`) where appropriate.
- For CSV export, return `Content-Type: text/csv` and stream rows to avoid memory pressure on large events.

---

If you want, I can implement the backend API changes for the merchandise approval and attendance tracking first (models + controllers + email/QR generation), then add minimal frontend flows (`upload-proof` and `QRScanner`) so organisers can test end-to-end. Confirm and I'll start by adding the new models, routes, and controllers in `backend/`.

---

### Tier C — Anonymous Post-Event Feedback System

**Why chosen:** Honest post-event feedback drives improvement. Anonymity (no names shown) encourages candid reviews over polite ones.

**Implementation:**
- Feedback is only available after the event end date has passed (`event.date < Date.now()`).
- Only participants who attended (have an approved/attended registration) can submit feedback.
- Submission stores a 1–5 star rating and optional comment. The participant ID is stored server-side for deduplication but **never exposed** in the public API response — display shows only "Participant" as the author label.
- Aggregate stats endpoint returns average rating and per-star distribution counts for the organiser analytics view.

---

## Setup & Installation

### Prerequisites

- Node.js 18 LTS or newer
- npm 9+
- MongoDB (Atlas free tier or local instance)

### 1. Backend

```bash
cd backend
cp .env.example .env   # then edit .env with your values
npm install
npm run dev            # starts on http://localhost:5000
```

Required `.env` values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random secret string for signing tokens |
| `JWT_EXPIRE` | Token expiry e.g. `7d` |
| `EMAIL_HOST` | SMTP host (optional — Ethereal fallback used in dev) |
| `EMAIL_PORT` | SMTP port (e.g. `587`) |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `EMAIL_FROM` | Display-from address (e.g. `no-reply@felicity.iiit.ac.in`) |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |

> **Dev tip:** If SMTP credentials are not set, the backend creates a temporary [Ethereal](https://ethereal.email) account and logs a preview URL to the console for every sent email — no real email service needed for development.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173 (or next available port)
```

Create `frontend/.env` (or `frontend/.env.local`) if the backend is not on the default port:

```
VITE_API_URL=http://localhost:5000/api
```

### 3. Running both together

Open two terminals — one for backend, one for frontend. The frontend Vite dev server proxies `/api` requests to the backend automatically when `VITE_API_URL` is not set.

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@felicity.iiit.ac.in | Admin@123 |
| Organiser | byld@felicity.iiit.ac.in | Organizer@123 |
| IIIT Student | student1@students.iiit.ac.in | Student@123 |
| Non-IIIT | visitor1@gmail.com | Visitor@123 |

The admin account is seeded automatically on first backend start via `config/seedAdmin.js`.

---

## Project Structure

```
2024117010/
├── backend/
│   ├── config/            # DB connection (db.js), admin auto-seed (seedAdmin.js)
│   ├── controllers/       # Route handlers: auth, event, registration, admin,
│   │                      #   user, feedback, discussion, notification, team
│   ├── middleware/        # JWT auth guard, error handler, multer file upload
│   ├── models/            # Mongoose schemas: User, Event, Registration,
│   │                      #   Feedback, Message, Notification, Team, EmailQueue
│   ├── routes/            # Express routers mounted at /api/*
│   ├── services/          # Email service (queue + worker), event helpers,
│   │                      #   registration helpers, GridFS file service
│   ├── utils/             # JWT helpers, QR code generator, email templates,
│   │                      #   CAPTCHA generator, calendar utilities
│   ├── server.js          # Entry point — Express app, middleware stack, routes
│   └── package.json
├── frontend/
│   ├── public/            # Static assets
│   └── src/
│       ├── components/    # Reusable UI: Navbar, ProtectedRoute, EventCard,
│       │                  #   admin/, organizer/, participant/ subdirectories
│       ├── context/       # AuthContext (global user state), ThemeContext
│       ├── hooks/         # Shared custom hooks
│       ├── pages/         # Page-level components (one per route)
│       ├── services/      # API call wrappers per domain (authService, eventService…)
│       ├── utils/         # Fuzzy search, helpers
│       ├── App.jsx        # Router + layout
│       └── main.jsx       # React root
├── README.md
└── deployment.txt
```
