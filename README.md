# QuanTech Enterprise Support Portal

A prototype IT service ticketing portal for **QuanTech SAL**, a Lebanese enterprise
technology and systems integration company (Midis Group, est. 1995). Enterprise
clients (banks, telecoms, healthcare groups, etc.) submit and track IT support
tickets; QuanTech technicians triage, assign, and resolve them.

Built with Node.js, Express, EJS, vanilla JavaScript, and hand-written CSS — no
frontend framework, no CSS framework, no chart library.

## Getting started

1. Copy `.env.example` to `.env` and fill in a Postgres connection string
   (this project uses [Neon](https://neon.tech), but any Postgres works), a
   `SESSION_SECRET`, and a `BLOB_READ_WRITE_TOKEN` (from a
   [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store — used for
   ticket attachments).
2. Install dependencies and set up the database:

   ```bash
   npm install
   npm run migrate   # creates the schema (idempotent, safe to re-run)
   npm run seed       # wipes and re-inserts the demo data
   ```
3. Run the app:

   ```bash
   npm run dev     # node --watch server.js — auto-restarts on file changes
   # or
   npm start
   ```

Then open **http://localhost:3000**. Demo accounts (shown on the login page):

| Role | Email | Password |
|---|---|---|
| Enterprise client | `rania.saad@abcbank.com` | `QuanTech#2026` |
| QuanTech technician | `michael.haddad@quantech.com` | `QuanTech#2026` |

All ten seeded users (5 clients across different companies, 4 technicians, 1
support manager with the `admin` role) share the same demo password — see
`src/data/seed/users.js`. Re-running `npm run seed` resets everything (tickets,
replies, assignments) back to this original demo state.

## What's implemented

- **Auth**: session-based login (bcrypt-hashed passwords, `express-session`
  backed by a `session` table via `connect-pg-simple`, session regenerated on
  login, role-restricted routes enforced server-side).
- **Client workflow**: dashboard with live stats/charts, create ticket (with file
  attachments), My Tickets (search + filter), ticket detail (conversation, reply,
  close/reopen, live SLA countdown), Knowledge Base, Profile & Settings.
- **Technician/admin workflow**: technician dashboard with org-wide stats,
  overdue-ticket tracking, a searchable/filterable all-tickets table with inline
  technician reassignment, bulk assign/status-change across selected tickets,
  CSV export, status/priority changes, and internal (client-hidden) notes.
- **Dark mode**: toggle in the topbar, respects OS preference by default,
  explicit choice persisted in `localStorage`.
- **Data**: real Postgres (see `src/data/db.js`, `src/data/migrations/`,
  `scripts/seed.js`). The `src/models/*` layer is the only place that issues
  SQL — controllers/routes/views never touch the database directly.

## Project structure

```
server.js              # entry point
scripts/
  migrate.js           # runs src/data/migrations/*.sql
  seed.js               # wipes + re-inserts demo data
src/
  app.js               # express app + middleware wiring
  config/constants.js  # categories, priorities, statuses, roles, colors
  data/
    db.js              # Postgres pool (Neon serverless driver)
    migrations/        # schema SQL, applied in filename order
    seed/               # demo data builders (consumed by scripts/seed.js)
  models/              # data access layer — all SQL lives here
  controllers/         # request handlers (async, query the model layer)
  routes/               
  middleware/          # auth (session/role checks), file upload
  utils/                
views/                 # EJS templates + partials (shared shell, badges, cards)
public/
  css/                 # design tokens → base/layout/components → page-specific
  js/                  # vanilla JS, one file per page/concern, no build step
api/
  index.js             # Vercel serverless entry point (wraps the same Express app)
vercel.json             # rewrites everything to api/index.js; bundles views/ + public/
```

## Notes on the prototype

- **Database driver**: uses `@neondatabase/serverless` (HTTP/WebSocket-based)
  rather than the standard `pg` package — it works from environments without
  raw TCP socket access (serverless functions, some sandboxes) and is also the
  recommended driver for a Vercel deployment, so the same code works in both
  places.
- File uploads are validated by size/MIME whitelist and streamed straight to
  Vercel Blob (public access, randomized path) rather than local disk — needed
  since a serverless deployment's filesystem is read-only/ephemeral. The
  original filename is preserved for display only.
- **Deploying on Vercel**: import the repo, connect a Neon Postgres store and
  a Blob store from the project's Storage tab (these auto-populate
  `DATABASE_URL`/`DATABASE_URL_UNPOOLED` and `BLOB_READ_WRITE_TOKEN`), and add
  `SESSION_SECRET` manually under Settings → Environment Variables — it isn't
  provisioned by either integration. Run `npm run migrate` and `npm run seed`
  once (locally, pointed at the same `DATABASE_URL`) before the first deploy.
- "Remember me" extends the session cookie to 30 days; otherwise it's a
  browser-session cookie.
- Every ticket mutation (reply, status change, priority change, assignment,
  close/reopen) is appended to that ticket's history, which doubles as both
  the client-facing conversation thread and the audit trail.
- Ticket numbers (`QNT-2026-000xx`) come from a Postgres sequence
  (`ticket_number_seq`), continuing on from where the seed data leaves off.
