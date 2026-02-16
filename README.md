# Felicity 2026 — Event Management System

Full-stack app for managing events, tickets, merchandise and organizer workflows for Felicity 2026.

---

Table of contents
- Overview
- Tech stack and justification
- Implemented advanced features (Tier A/B/C) with design notes
- Setup & installation (local development)
- Running tests & manual checks
- Notes on email deliverability, QR tickets and payment proof

## Overview

Felicity 2026 is built to manage events, ticketing, merchandise, and organizer workflows for a college festival. It focuses on developer ergonomics (Vite, hot reload), reliable email previewing during development (Ethereal fallback), and production-ready patterns (pooled SMTP transporter, email envelope control, registration QR codes, and background email queue model).

## Tech stack and libraries (frontend & backend)

Frontend
- React (via Vite) — fast HMR, small dev friction and modern React features. Chosen for component-based architecture and ecosystem.
- React Router — client-side routing between pages (landing, events, login, dashboard).
- react-hot-toast — lightweight user toast notifications for feedback on actions.
- axios — promise-based HTTP client, used for API calls to the backend.
- Tailwind-like custom CSS (project uses hand-crafted CSS in `src/index.css`) — chosen to keep UI lightweight and custom without bringing a full UI library; this project can easily swap to Tailwind/Material UI if desired.

Backend
- Node.js + Express (ESM) — minimal, flexible backend framework suitable for REST APIs and middleware.
- MongoDB + Mongoose — document DB with schema modeling and middleware hooks for registration and trending features.
- Nodemailer — pragmatic choice for SMTP; supports fallbacks (Ethereal) for dev and pooling for production SMTP.
- jsonwebtoken (JWT) — token-based auth for API protection.
- bcrypt — secure password hashing.

Why these choices
- React + Vite: developer speed + fast reloads; Vite is recommended for modern React projects for its performance.
- Express + Node: ubiquitous, easy to extend, and integrates well with Nodemailer and Mongoose.
- Mongoose: schema validation and middleware allow server-side enforcement of business rules (e.g., registration counters, recentRegistrations for trending events).
- Nodemailer: flexible provider support (SMTP, SendGrid via SMTP, etc.) and Ethereal preview makes templates easy to verify during development.

## Advanced features implemented (Tier A / B / C)

Note: feature tiers are interpreted as increasing complexity / domain coverage. I implemented a representative set across tiers to provide real value for an event platform.

- Tier A (Core features)
  - Participant registration with IIIT vs External flow
    - Rationale: event platforms must enforce eligibility. The register page presents IIIT vs External choice and validates IIIT emails.
    - Design: the frontend shows a choice screen, hides the college input when IIIT is selected, and the backend validates domain lists (e.g., `iiit.ac.in`, `students.iiit.ac.in`, `research.iiit.ac.in`).
  - Email confirmations (registration & purchases)
    - Rationale: ticketing requires confirmations; these contain ticket IDs and QR codes.
    - Implementation: backend generates ticket data and attaches a QR data URL to the registration object; `sendRegistrationEmail` includes the QR image inline when available.
  - Merchandise purchases & stock tracking
    - Rationale: needed for event merch sales.
    - Implementation: purchases create a registration-like record; confirmation email is sent with order details.

- Tier B (UX / Admin / Reliability)
  - Admin organizer management, credential emails to provided contact addresses
    - Rationale: admins should control organizer contact emails; credentials are delivered to the real contact email.
    - Implementation: `sendOrganizerCredentials(loginEmail, password, organizerName, deliveryEmail)` supports delivering to the contact email.
  - Email utility resilience and dev preview
    - Rationale: dev environments often lack SMTP credentials — Ethereal fallback ensures templates can be previewed.
    - Implementation: `backend/utils/email.js` tries real SMTP first, falls back to Ethereal in non-production, returns preview URLs and logs envelope/SMTP responses for troubleshooting.
  - Live fuzzy-search on list pages (debounced)
    - Rationale: better UX for searching events/clubs.
    - Implementation: client-side fuzzy filtering with a small debounce for instant feedback. Submit still hits the API for full results.

- Tier C (Advanced & Operational)
  - No-reply display-from + correct SMTP envelope handling
    - Rationale: corporate email flows often require a consistent display sender while authenticating as an SMTP user — to reduce confusion and keep authentication working.
    - Implementation: the email util sets a display-from (no-reply@felicity.iiit.ac.in by default) and keeps the SMTP envelope.from as the auth user for successful authentication.
  - Event trending and recent registrations tracking
    - Rationale: prioritize events on the home/browse pages.
    - Implementation: Event model stores recentViews and recentRegistrations and a trending endpoint computes top events.

Design decisions & tradeoffs
- Email strategy: prefer an explicit display-from (no-reply) while using SMTP auth for envelope. This improves recipient clarity while keeping delivery reliability.
- Fuzzy search: client-side filtering gives instant feedback (snappy UX) but for complete data or multi-page results, the server API is still used via submit.
- Logo sizing & responsiveness: landing logo is intentionally larger to create a strong visual hero; responsive breakpoints are available in CSS and can be tuned further.

## Quick Setup & Local Development

Prerequisites
- Node.js (LTS recommended; 16+)
- npm or yarn
- MongoDB connection (Atlas or local)

1. Backend

- Copy environment variables

  - Create a `.env` in `backend/` based on `.env.example`.
  - Important values:
    - `MONGODB_URI` — your MongoDB connection string
    - `EMAIL_USER` and `EMAIL_PASS` — SMTP credentials for sending emails (optional: if not set, the dev server uses Ethereal)
    - `EMAIL_HOST`, `EMAIL_PORT` — optional SMTP host/port
    - `EMAIL_FROM` or `EMAIL_FROM_ADDRESS` — display-from address (defaults to `no-reply@felicity.iiit.ac.in`)
    - `EMAIL_REPLY_TO` — reply-to address (defaults to same no-reply address)

- Install & start backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on port 5000 by default. The dev server logs SMTP verification and any Ethereal preview URLs if fallback used.

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5174` (or the port Vite prints) to view the landing page.

3. Testing email templates
- If SMTP creds are not configured, the backend will create an Ethereal account and log a preview URL when sending emails — use that preview URL to inspect the message.
- To test registration and confirm the QR ticket:
  1. Register a participant via the frontend (or call `POST /api/auth/register`).
  2. The backend will create a registration and (if QR generation is configured) include `registration.qrCodeData` which is embedded into the registration confirmation email.

## Where ticket QR and payment proof appear

- Ticket QR in email: `backend/utils/email.js` includes the registration object's `qrCodeData` (data URL) in the `sendRegistrationEmail` template. When a registration includes a `qrCodeData` field, the email HTML embeds it — recipients receive the QR inline.
- Payment proof option: the system supports uploading payment proofs for purchases that require manual verification. The backend has endpoints to upload payment proofs (see `backend/controllers/registrationController.js` and `backend/middleware/upload.js`). The frontend exposes payment/proof flows in the event purchase path. If you need a dedicated UI change (for example, toggling an option when fee == 1), tell me where you want the upload UI to appear and I will add/adjust the frontend page.

## Reducing logo/text spacing (visual tweak)
- The landing hero spacing has been tuned so the logo and subtitle sit closer together for a stronger visual. The CSS class `.landing-subtitle` and `.landing-desc` are tightly spaced and the landing logo is larger.

## Email deliverability notes (operational)
- For production sending use a transactional email provider (SendGrid, Mailgun, Postmark) or ensure SPF/DKIM records are set for your SMTP domain. Gmail or personal SMTP often result in quarantine or spam for large batch sends.
- Logs include envelope and server responses to help debug rejections.

## Next recommended improvements (optional)
- Add responsive CSS breakpoint tuning for the landing logo so very small screens get a slightly smaller logo.
- Add automated unit/integration tests for registration and email templates.
- Integrate a proper transaction email provider SDK to improve deliverability and analytics.

---

If you'd like, I can also:
- Add a frontend payment-proof upload UI in the purchase flow (show the upload button when event fee > 0 or always show an optional proof upload button).
- Extend the README with API docs (endpoints and request/response examples).

Tell me which of the follow-ups you'd like me to implement next.
# Felicity Event Management System

A full-stack event management system for IIIT Hyderabad's annual techno-cultural fest **Felicity**, built with the MERN stack.

## Tech Stack

- **Frontend**: React 19 (Vite), React Router 7, Axios, react-hot-toast
- **Backend**: Node.js, Express 5, Mongoose 9
- **Database**: MongoDB Atlas
- **Auth**: JWT + bcryptjs, role-based access control

## Roles

1. **Participant** - Browse events, register, purchase merchandise, view tickets
2. **Organizer** - Create/manage events, custom registration forms, view registrations
3. **Admin** - Manage organizers, view platform statistics, handle password resets

## Features (Part 1 - Core)

### Authentication & Authorization
- IIIT vs Non-IIIT registration flow with email domain validation
- JWT-based authentication with role-based route protection
- Participant onboarding (interests + club following)

### Events
- CRUD operations with draft → published workflow
- Custom registration form builder (text, textarea, dropdown, checkbox, number, email)
- Merchandise events with variants (size, color, stock tracking)
- Eligibility restrictions (IIIT-only, non-IIIT-only, open to all)
- Trending events based on view count
- Search (partial matching) and filters (type, eligibility, date)
- Pagination

### Registrations
- Event registration with custom form responses
- Merchandise purchase with variant selection and stock management
- QR code ticket generation
- Registration cancellation with stock restoration
- CSV export of registrations

### Organizer Management (Admin)
- Add organizers with auto-generated credentials
- Enable/disable organizer accounts
- Password reset functionality

### User Profiles
- Editable and non-editable fields per specification
- Follow/unfollow clubs with notifications
- Interest-based recommendations

### Dark/Light Mode
- Full theme support with CSS custom properties
- Persisted theme preference via localStorage

## Advanced Features (Part 2 - 30 marks)

### Tier A: Merchandise Payment Approval Workflow + QR Scanner (12 marks)
- **Why chosen**: Payment verification is critical for a real event management system. Combined with QR-based attendance, it provides an end-to-end participant experience.
- **Payment Flow**: Participants upload payment proof → Organizer reviews → Approve (generates QR + confirmation email) or Reject (restores stock)
- **QR Scanner**: Paste-based QR data input for marking attendance, with duplicate scan prevention and manual override capability
- **Attendance Dashboard**: Real-time statistics for organizers

### Tier B: Organizer Password Reset + Discussion Forum (12 marks)
- **Why chosen**: Password management is essential for multi-role systems. Discussion forums enable real-time community engagement during events.
- **Password Reset**: Organizers request reset → Admin reviews requests → Admin resets and auto-generates new password
- **Discussion Forum**: Event-specific threaded discussions with message pinning, reactions, and long-polling for real-time updates. Only registered participants and event organizers can post.

### Tier C: Anonymous Feedback System (6 marks)
- **Why chosen**: Post-event feedback is crucial for improving future events. Anonymity encourages honest reviews.
- **Features**: 1-5 star rating with optional comments, available only after event completion, only for attended participants, anonymous display (no participant names shown), average rating calculation with distribution stats.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@felicity.iiit.ac.in | Admin@123 |
| Organizer | byld@felicity.iiit.ac.in | Organizer@123 |
| IIIT Student | student1@students.iiit.ac.in | Student@123 |
| Non-IIIT | visitor1@gmail.com | Visitor@123 |

## Project Structure

```
2024117010/
├── backend/
│   ├── config/          # DB connection, admin seeding
│   ├── controllers/     # Route handlers (auth, event, registration, admin, user, feedback, discussion)
│   ├── middleware/       # Auth, error handling, file upload
│   ├── models/          # Mongoose schemas (User, Event, Registration, Feedback, Message)
│   ├── routes/          # API routes
│   ├── utils/           # JWT, QR code, email utilities
## Technologies (what and why)

- Frontend
  - React + Vite: fast development, component model.
  - React Router: client routes.
  - axios: API requests.
  - react-hot-toast: small, unobtrusive notifications.
  - CSS: project uses a custom stylesheet (`frontend/src/index.css`) for layout and visual styles.

- Backend
  - Node.js + Express: REST API, middleware, and routing.
  - MongoDB + Mongoose: document store with schema validation and middleware hooks.
  - Nodemailer: SMTP sending, with Ethereal fallback for development previews.
  - jsonwebtoken, bcrypt: auth and password hashing.

## Implemented advanced features

- Tier A (core)
  - Participant registration with IIIT vs External choice and domain validation.
  - Registration confirmation emails include ticket ID and inline QR (if QR is generated and attached to the registration record).
  - Merchandise purchases with order confirmation emails.

- Tier B (UX/admin)
  - Organizer management (admin) and delivery of organizer credentials to the admin-provided contact email.
  - Email utility: SMTP pooling, Ethereal fallback, preview URLs and envelope logging.
  - Live fuzzy-search (debounced) on Browse Events for instant filtering.

- Tier C (operational)
  - Display-from set to a no-reply address by default; SMTP envelope uses the configured auth user so sending works while recipients see a no-reply sender.
  - Event trending uses recent registration/view counters stored on events.

## Setup (local)

1) Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI, EMAIL_USER, EMAIL_PASS (optional), FRONTEND_URL
npm install
npm run dev
```

Default backend port: 5000

2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the port Vite prints (typically `http://localhost:5174`).

## QR tickets and payment proof

- QR tickets: when a registration record contains `qrCodeData` (a data URL), the registration confirmation email embeds it. The template is in `backend/utils/email.js` (see `sendRegistrationEmail`).
- Payment proof: upload endpoints and middleware are implemented in `backend/controllers/registrationController.js` and `backend/middleware/upload.js`. Frontend shows the payment/proof flow on the purchase path; if an event's fee is ₹1 and manual verification is required, the payment proof upload is available during or after checkout.

## Visual tweak

- Landing logo size and spacing were adjusted in `frontend/src/index.css` to make the logo larger and reduce the gap to the subtitle.

## Notes on deliverability

- For production use a transactional provider or configure SPF/DKIM for the sending domain. The app logs SMTP envelope and server responses to aid troubleshooting.
