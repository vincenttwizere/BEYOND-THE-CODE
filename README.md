# BEYOND THE CODE

BEYOND THE CODE is a responsive editorial blog and content-management application. Readers can browse published stories, search and filter content, register for an account, save posts, and participate in moderated discussions. Administrators use a private dashboard to manage stories, taxonomies, media, users, pages, newsletters, analytics, and site settings.

## Technology

- React 19 and React Router
- Vite
- Express
- JSON file storage
- Node.js built-in test runner
- EmailJS for the public contact form
- Lucide React icons

## Project structure

```text
frontend/
  public/       Static images and public assets
  src/
    Components/ React views and dashboard components
    App.jsx     Application routes
    AuthContext.jsx
    admin.css
    index.css
  vite.config.js

backend/
  data/
    db.json     Initial application data
  tests/
    api.test.js
  index.js      Express API and application bootstrap
  store.js      JSON data store

.env.local      Local private configuration
package.json
```

## Features

### For readers

- Responsive home, category, search, and post views
- Registration, sign-in, profile management, and password updates
- Full articles restricted to signed-in readers
- Saved-post and liked-post collections
- Reader profiles and comments
- Newsletter subscription with consent
- Contact form powered by EmailJS

### For administrators

- Overview and analytics dashboards
- Draft, scheduled, published, and archived posts
- Markdown and code-block editing with SEO and featured-image fields
- Category and tag management
- Comment moderation
- User suspension, banning, and role management
- Media uploads and library management
- Static pages and navigation settings
- Newsletter drafts and subscriber management
- Maintenance mode and general site settings

## Requirements

- Node.js 18 or later
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the repository root:

   ```env
   # Public browser variables for the EmailJS contact form
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key

   # Express API configuration
   API_PORT=8000
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=use-a-unique-password

   # Optional: custom live-data location
   # DATA_FILE=C:\absolute\path\to\app-db.json
   ```

   `.env.local` is ignored by Git. Use a public EmailJS key only; never put a private EmailJS key in a `VITE_*` variable.

3. Start the API and frontend in separate terminals:

   ```bash
   npm run server
   npm run dev
   ```

   Vite proxies `/api` requests to `http://localhost:8000`. Open the URL printed by Vite.

4. Sign in at `/login` with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then open `/admin`.

   Reader registrations are public and always receive the `reader` role. The administrator account is created or synchronized on API startup.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_EMAILJS_SERVICE_ID` | For contact form | EmailJS service identifier |
| `VITE_EMAILJS_TEMPLATE_ID` | For contact form | EmailJS template identifier |
| `VITE_EMAILJS_PUBLIC_KEY` | For contact form | Browser-safe EmailJS public key |
| `API_PORT` | No | API port; defaults to `8000` |
| `ADMIN_EMAIL` | Yes | Initial/synchronized administrator email |
| `ADMIN_PASSWORD` | Yes | Initial/synchronized administrator password |
| `DATA_FILE` | No | Custom path for the live JSON database |
| `NODE_ENV` | No | Set to `production` to enable secure cookies |

Changing `ADMIN_PASSWORD` rotates the password for the configured administrator account. The configured administrator cannot be demoted or deleted through the dashboard.

## Data and content behavior

The API creates `backend/data/app-db.json` from `backend/data/db.json` on first startup. This live file stores accounts, sessions, posts, comments, subscribers, media metadata, pages, newsletters, analytics, saved posts, liked posts, categories, tags, and settings.

`app-db.json` is ignored by Git. Back it up before replacing or redeploying the application. Uploaded files are stored next to the active JSON data file.

- Scheduled posts become published when a public or administrator blog list is requested after their scheduled time.
- Analytics uses first-party page-view events and does not store visitor IP addresses.
- Passwords are salted with scrypt.
- Session tokens are random and stored server-side as hashes in HTTP-only, same-site cookies.
- Public registration cannot assign administrator privileges.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Health check |
| `GET` | `/api/site-settings` | Public | Public site configuration |
| `GET` | `/api/pages` | Public | List published static pages |
| `GET` | `/api/pages/:slug` | Public | Read a published static page |
| `POST` | `/api/auth/signup` | Public | Register a reader |
| `POST` | `/api/auth/login` | Public | Start a session |
| `POST` | `/api/auth/logout` | Public | End a session |
| `GET` | `/api/auth/me` | Signed in | Read the current account |
| `PATCH` | `/api/auth/profile` | Signed in | Update profile or password |
| `GET` | `/api/blogs` | Public | List published posts; supports `q` search |
| `GET` | `/api/blogs/:id` | Signed in | Read a full published post |
| `GET/POST` | `/api/blogs/:id/comments` | Signed in to create | Read or submit comments |
| `GET/POST/DELETE` | `/api/me/saved-posts` | Signed in | Manage saved posts |
| `GET/POST/DELETE` | `/api/blogs/:id/likes` and `/api/me/liked-posts/:id` | Signed in | Read or change post likes |
| `POST` | `/api/analytics/pageview` | Public | Record an anonymized page view |
| `POST` | `/api/newsletter/subscribe` | Public | Subscribe to the newsletter |
| `GET/POST/PATCH/DELETE` | `/api/admin/blogs` | Admin | Manage posts |
| `GET` | `/api/admin/overview` | Admin | Read dashboard metrics |
| `GET` | `/api/admin/analytics` | Admin | Read analytics |
| `GET/POST/PATCH/DELETE` | `/api/admin/categories` | Admin | Manage categories |
| `GET/POST/PATCH/DELETE` | `/api/admin/tags` | Admin | Manage tags |
| `GET/PATCH/DELETE` | `/api/admin/comments` | Admin | Moderate comments |
| `GET/PATCH/DELETE` | `/api/admin/users` | Admin | Manage accounts |
| `GET/PATCH/DELETE` | `/api/admin/subscribers` | Admin | Manage newsletter subscribers |
| `GET/POST/PATCH/DELETE` | `/api/admin/newsletters` | Admin | Manage newsletter drafts |
| `GET/POST/PATCH/DELETE` | `/api/admin/media` | Admin | Manage media |
| `GET/POST/PATCH/DELETE` | `/api/admin/pages` | Admin | Manage static pages |
| `GET/PATCH` | `/api/admin/settings` | Admin | Read or update site settings |

All `/api/admin/*` endpoints require an administrator session.

## Scripts

```bash
npm run dev       # Start the Vite development server
npm run server    # Start the Express API
npm run build     # Build the frontend for production
npm run preview   # Preview the production build
npm run lint      # Run ESLint
npm test          # Run Node.js API tests
```

## Production notes

- Provide `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATA_FILE` through deployment secrets or environment configuration.
- Set `NODE_ENV=production` and serve the site over HTTPS so secure session cookies are enabled.
- Persist the live JSON file outside ephemeral container storage or mount it in a persistent volume.
- Put the frontend and API on the same site or otherwise configure CORS and cookie behavior appropriately.
- Keep `VITE_*` secrets public-safe. They are compiled into browser assets.
- Configure a server-side email provider before enabling newsletter delivery. The newsletter send endpoint returns `503` until delivery is configured.
