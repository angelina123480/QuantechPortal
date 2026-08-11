# QuanTech Enterprise Support Portal

A prototype IT service ticketing portal for **QuanTech SAL**, a Lebanese enterprise
technology and systems integration company (Midis Group, est. 1995). Enterprise
clients (banks, telecoms, healthcare groups, etc.) submit and track IT support
tickets; QuanTech technicians triage, assign, and resolve them.

Built with Node.js, Express, EJS, vanilla JavaScript, and hand-written CSS — no
frontend framework, no CSS framework, no chart library.

## Getting started

```bash
npm install
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
`src/data/seed/users.js`.

## What's implemented

- **Auth**: session-based login (bcrypt-hashed passwords, `express-session`,
  session regenerated on login, role-restricted routes enforced server-side).
- **Client workflow**: dashboard with live stats/charts, create ticket (with file
  attachments), My Tickets (search + filter), ticket detail (conversation, reply,
  close/reopen), Knowledge Base, Profile & Settings.
- **Technician/admin workflow**: technician dashboard with org-wide stats,
  overdue-ticket tracking, a searchable/filterable all-tickets table with inline
  technician reassignment, status/priority changes, and internal (client-hidden)
  notes.
- **Data**: everything is in-memory, seeded on process start (`src/data/store.js`).
  Restarting the server resets all data. The `src/models/*` layer is the only
  place that talks to the store — swapping in Postgres later means rewriting
  those files, not the controllers/routes/views above them.

## Project structure

```
server.js              # entry point
src/
  app.js               # express app + middleware wiring
  config/constants.js  # categories, priorities, statuses, roles, colors
  data/                # in-memory store + seed data
  models/              # data access layer (would become SQL queries later)
  controllers/         # request handlers
  routes/               
  middleware/          # auth (session/role checks), file upload
  utils/                
views/                 # EJS templates + partials (shared shell, badges, cards)
public/
  css/                 # design tokens → base/layout/components → page-specific
  js/                  # vanilla JS, one file per page/concern, no build step
  uploads/             # ticket attachments land here (multer, disk storage)
```

## Notes on the prototype

- Session storage is the default in-memory `express-session` store — fine for a
  single-process demo, not for production (a Postgres/Redis session store would
  replace it alongside swapping the data layer).
- File uploads are validated by size/MIME whitelist and stored under randomized
  filenames; the original filename is preserved for display only.
- "Remember me" extends the session cookie to 30 days; otherwise it's a
  browser-session cookie.
- Every ticket mutation (reply, status change, priority change, assignment,
  close/reopen) is appended to that ticket's `history` array, which doubles as
  both the client-facing conversation thread and the audit trail.
