# BEYOND </>

BEYOND is an editorial blog built with React, Vite, and an Express API. Readers can browse published stories and sign in to read full articles. Administrators get a private dashboard for publishing stories and managing reader accounts.

Frontend application code lives in `frontend/`, and backend implementation code lives in `backend/`. Shared npm scripts, dependencies, and tooling configuration remain at the repository root.

```text
frontend/
  public/
  src/
  index.html
  vite.config.js
backend/
  data/
  tests/
  index.js
  store.js
```

## Features

- Responsive journal with category browsing and search
- Reader registration and sign-in using password hashes and HTTP-only sessions
- Role-based access for readers and administrators
- Full story pages available only to signed-in users
- Admin dashboard for creating, editing, publishing, drafting, and deleting stories
- Reader management, including role changes and account removal
- Persistent JSON data store initialized from `backend/data/db.json`
- EmailJS contact form integration

## Requirements

- Node.js 18 or later
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a private `.env.local` file in the project root with your EmailJS settings and a unique administrator email and strong password. Do not commit this file.

   ```env
   VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=use-a-unique-strong-password
   API_PORT=8000
   ```

   The initial administrator is created when the API starts. The configured administrator password is synchronized at startup, so changing `ADMIN_PASSWORD` rotates that account's password.

3. Run the API and frontend in separate terminals:

   ```bash
   npm run server
   npm run dev
   ```

   Vite proxies `/api` requests to the API on port 8000. Open the Vite URL shown in the terminal.

4. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` to open `/admin`. Readers can register from `/login`; new public registrations receive the reader role.

The API stores live content and accounts in the ignored `backend/data/app-db.json` file. It is created from `backend/data/db.json` the first time the backend starts. Back up this file to preserve your live data.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Register a reader |
| `POST` | `/api/auth/login` | Public | Start a session |
| `POST` | `/api/auth/logout` | Public | End the current session |
| `GET` | `/api/auth/me` | Signed in | Read the current account |
| `GET` | `/api/blogs` | Public | List published story summaries; supports `q` search |
| `GET` | `/api/blogs/:id` | Signed in | Read a published story in full |
| `GET/POST/PATCH/DELETE` | `/api/admin/blogs` | Admin | Manage stories |
| `GET/PATCH/DELETE` | `/api/admin/users` | Admin | Manage reader accounts and roles |

Passwords are stored as salted scrypt hashes. Session identifiers are random, stored server-side as hashes, and sent in HTTP-only, same-site cookies. The configured administrator cannot be demoted or deleted. Public registration cannot assign administrator privileges.

For production, provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` through the deployment's secret manager, set `NODE_ENV=production` to enable secure cookies, persist `backend/data/app-db.json`, and route the frontend and API through the same site so the session cookie remains first-party.

## Scripts

```bash
npm run dev       # Start the Vite development server
npm run server    # Start the Express API
npm run build     # Build the frontend for production
npm run preview   # Preview the production frontend
npm run lint      # Run ESLint
npm test          # Run backend API tests
```

## EmailJS

The contact form sends messages through EmailJS. Configure the three `VITE_EMAILJS_*` values in `.env.local`. Only use an EmailJS public key in browser-exposed `VITE_` variables; never put a private key in frontend configuration.
