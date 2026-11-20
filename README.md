# BEYOND THE CODE

**BEYOND THE CODE** is a responsive editorial platform and content-management system that I built for publishing thoughtful stories, organizing ideas, and creating a direct connection between writers and readers.

The public side of the project provides an image-led reading experience with search, categories, static pages, newsletters, comments, and reader accounts. Behind it, I included a private administration area for managing the entire publication: articles, taxonomy, media, subscribers, users, comments, pages, analytics, navigation, and site settings.

![Project status](https://img.shields.io/badge/status-active_development-blue)
![License](https://img.shields.io/badge/license-not_yet_declared-lightgrey)

## Why I Built It

I wanted to go beyond a basic article viewer and build a complete editorial workflow in a small, understandable codebase. BEYOND THE CODE combines a React 19 reader experience with an Express API and local JSON storage, making the application easy to inspect, run, and extend without a database setup.

It is intended for portfolios, editorial prototypes, personal publications, demos, and small deployments that do not require a distributed database. For high-traffic or multi-instance production environments, I recommend moving the JSON store to a managed database and the uploaded media to object storage before launch.

## What You Can Do

### Readers

- Browse a responsive editorial home page and curated article collections
- Search and filter published stories
- Open stories by category or tag
- Create an account and update a reader profile
- Sign in securely and save or like posts
- Add comments that wait for administrator approval
- Subscribe to the newsletter
- Send a public inquiry through EmailJS
- Read configurable About and other static pages

### Administrators

- Publish, draft, schedule, and archive stories
- Edit rich content with Markdown and code blocks
- Manage titles, excerpts, featured images, SEO fields, categories, and tags
- Upload media and maintain a media library
- Review and moderate reader comments
- Suspend, ban, or delete reader accounts
- Create and manage static pages
- Configure navigation, footer links, branding, SEO, and maintenance mode
- Review page-view and publication analytics
- Create newsletter drafts and manage subscribers

### Planned Publishing Integration

Newsletter delivery is exposed in the dashboard, but sending is not connected to an email provider yet. The send endpoint intentionally returns `503` until I add server-side delivery.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8 |
| API | Node.js, Express 4 |
| Storage | Atomic JSON-file persistence |
| Authentication | HTTP-only session cookies, scrypt password hashing |
| Forms | EmailJS browser SDK |
| Icons | Lucide React |
| Testing | Node.js built-in test runner |
| Linting | ESLint |

## Project Structure

```text
BEYOND-THE-CODE/
├── backend/
│   ├── data/
│   │   └── db.json          # Seed content
│   ├── tests/
│   │   └── api.test.js      # API integration tests
│   ├── index.js             # Express application and API routes
│   └── store.js             # JSON persistence and data initialization
├── frontend/
│   ├── public/
│   │   └── images/          # Public image assets
│   ├── src/
│   │   ├── Components/      # Public, auth, and CMS views
│   │   ├── App.jsx          # Routes and global application behavior
│   │   ├── AuthContext.jsx  # Current-user state
│   │   ├── api.js           # API request helper
│   │   └── *.css            # Application styles
│   ├── index.html
│   └── vite.config.js
├── .env.local               # Local/private environment variables
├── package.json
└── README.md
```

## Requirements

- Node.js 18 or later
- npm
- A modern browser
- Optional: an EmailJS account for the contact form

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/vincenttwizere/BEYOND-THE-CODE.git
cd BEYOND-THE-CODE
npm install
```

### 2. Configure the environment

Create `.env.local` in the repository root:

```env
# Browser-safe EmailJS configuration
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key

# Express API configuration
API_PORT=8000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-unique-password

# Optional: use a persistent external JSON data file
# DATA_FILE=C:\absolute\path\to\app-db.json
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are required whenever the API starts. The password must contain 8 to 128 characters. On startup, I synchronize the configured account with administrator privileges; changing `ADMIN_PASSWORD` rotates the account password.

Never put a private EmailJS key in a `VITE_*` variable. Vite exposes these variables to browser code.

### 3. Start the application

Run the API and frontend in separate terminals:

```bash
npm run server
```

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

In development, Vite forwards `/api` requests to `http://localhost:8000`. Sign in at `/login` using `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then open `/admin`.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_EMAILJS_SERVICE_ID` | Contact form only | — | EmailJS service identifier |
| `VITE_EMAILJS_TEMPLATE_ID` | Contact form only | — | EmailJS contact template identifier |
| `VITE_EMAILJS_PUBLIC_KEY` | Contact form only | — | Browser-safe EmailJS public key |
| `API_PORT` | No | `8000` | Port used by the Express API |
| `ADMIN_EMAIL` | Yes | — | Initial/synchronized administrator email |
| `ADMIN_PASSWORD` | Yes | — | Initial/synchronized administrator password |
| `DATA_FILE` | No | `backend/data/app-db.json` | Location of the live JSON database |
| `NODE_ENV` | No | — | Set to `production` to enable secure cookies |

## Data and Storage

The API initializes `backend/data/app-db.json` from `backend/data/db.json` when the live file does not exist. I keep the generated file and uploaded media outside source control:

- `app-db.json` stores users, sessions, posts, comments, subscribers, media metadata, pages, newsletters, analytics, saved posts, likes, categories, tags, and settings
- Uploaded media is stored beside the active JSON data file
- Writes use a temporary file and atomic rename
- Updates are serialized inside the process

Back up the active JSON file and media directory before deployment or data migration. Do not scale this store across multiple server processes that use separate local files. It is a simple persistence layer, not a replacement for a relational or document database.

## Authentication and Security

- Reader registrations always receive the `reader` role
- Public registration payloads cannot assign administrator privileges
- Passwords use salted scrypt hashes
- Session tokens are random, stored as SHA-256 hashes, and carried in HTTP-only cookies
- Sessions expire after seven days
- `/api/admin/*` routes require an authenticated administrator
- Administrator accounts protected by `ADMIN_EMAIL` cannot be demoted or deleted through the dashboard
- Production sessions use the `Secure` cookie flag
- Analytics records a session visitor identifier and device type, rather than visitor IP addresses

The application is not a production threat model out of the box. Before exposing it publicly, review the infrastructure, HTTPS termination, reverse proxy, backup process, input limits, file storage, and email configuration.

## API Reference

The API uses JSON request and response bodies. `/api/admin/*` routes require an administrator session.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | API health check |
| `GET` | `/api/site-settings` | Public | Public branding and navigation settings |
| `GET` | `/api/pages` | Public | Published static pages |
| `GET` | `/api/pages/:slug` | Public | A published static page |
| `POST` | `/api/auth/signup` | Public | Register a reader |
| `POST` | `/api/auth/login` | Public | Start a session |
| `POST` | `/api/auth/logout` | Signed in | End a session |
| `GET` | `/api/auth/me` | Signed in | Current account |
| `PATCH` | `/api/auth/profile` | Signed in | Update profile or password |
| `GET` | `/api/blogs` | Public | Published posts and search |
| `GET` | `/api/blogs/:id` | Signed in | Full post content |
| `GET/POST` | `/api/blogs/:id/comments` | Public read, signed-in create | Comments |
| `GET/POST/DELETE` | `/api/me/saved-posts` | Signed in | Saved posts |
| `GET/POST/DELETE` | `/api/blogs/:id/likes`, `/api/me/liked-posts/:id` | Signed in | Post likes |
| `POST` | `/api/analytics/pageview` | Public | Record an anonymized page view |
| `POST` | `/api/newsletter/subscribe` | Public | Add or resume a subscription |
| `GET/POST/PATCH/DELETE` | `/api/admin/blogs` | Admin | Manage stories |
| `GET` | `/api/admin/overview` | Admin | Dashboard metrics |
| `GET` | `/api/admin/analytics` | Admin | Analytics data |
| `GET/POST/PATCH/DELETE` | `/api/admin/categories` | Admin | Manage categories |
| `GET/POST/PATCH/DELETE` | `/api/admin/tags` | Admin | Manage tags |
| `GET/PATCH/DELETE` | `/api/admin/comments` | Admin | Moderate comments |
| `GET/PATCH/DELETE` | `/api/admin/users` | Admin | Manage accounts |
| `GET/PATCH/DELETE` | `/api/admin/subscribers` | Admin | Manage newsletter subscribers |
| `GET/POST/PATCH/DELETE` | `/api/admin/newsletters` | Admin | Manage newsletter drafts |
| `GET/POST/PATCH/DELETE` | `/api/admin/media` | Admin | Manage media |
| `GET/POST/PATCH/DELETE` | `/api/admin/pages` | Admin | Manage static pages |
| `GET/PATCH` | `/api/admin/settings` | Admin | Read or update site settings |

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the Express API |
| `npm run build` | Create the frontend production bundle |
| `npm run preview` | Preview the built frontend locally |
| `npm run lint` | Run ESLint across the project |
| `npm test` | Run the Node.js API test suite |

## Testing

Run the API integration tests from the repository root:

```bash
npm test
```

The tests create an isolated JSON store and temporary API server, so they do not modify `backend/data/app-db.json`.

Before a release, I also recommend running:

```bash
npm run lint
npm run build
npm test
```

## Building for Production

Create the frontend assets:

```bash
npm run build
```

Vite writes the production bundle to `frontend/dist`.

The Express API does not automatically serve `frontend/dist`. Host the built frontend through Vite preview, a static hosting provider, or a reverse proxy, and expose the API at `/api`. Keep the browser origin and API origin aligned for cookies, or configure trusted cross-origin and CORS behavior carefully.

For a basic VM deployment:

1. Set `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `API_PORT` on the server.
2. Set `DATA_FILE` to a persistent volume or backup location.
3. Run `npm run server` under a process manager.
4. Publish `frontend/dist` through HTTPS.
5. Proxy `/api` to the Express port.
6. Mount or sync the media directory and database backup.
7. Review the `Secure`, `SameSite`, and cross-origin cookie behavior at the final domain.

## Deployment Checklist

- [ ] Use strong, unique administrator credentials
- [ ] Serve the frontend and API over HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Store the live JSON database on persistent storage
- [ ] Back up the database and media directory
- [ ] Keep the application on a single writable JSON-store instance
- [ ] Configure a server-side newsletter provider before enabling sends
- [ ] Configure public EmailJS variables for the contact form
- [ ] Verify that public routes expose no private account fields
- [ ] Add monitoring and log collection for the API
- [ ] Rotate administrator credentials after initial setup

## Contributing

Contributions are welcome. Before submitting changes:

1. Create a focused branch.
2. Keep changes consistent with the existing JavaScript and CSS conventions.
3. Add or update API tests for behavioral changes.
4. Run `npm run lint`, `npm run build`, and `npm test`.
5. Explain security or storage implications in the pull request.

## License

A license has not been declared in this repository yet. Until I add one, the source should not be treated as permission to reuse, publish, or distribute it outside the terms agreed with the author.
