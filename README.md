# BEYOND </>

BEYOND </> is a modern editorial blog and content platform built with React and Vite. It is designed for sharing ideas, stories, tutorials, and thoughtful commentary in a clean, fast, and engaging digital experience.

## About the Project

This project combines a polished reading experience with a flexible content structure, making it suitable for personal blogging, professional storytelling, or a developer portfolio. The platform is intentionally lightweight and easy to extend as the content and brand evolve.

## Key Features

- Responsive blog layout for desktop and mobile devices
- Article listing and detail pages
- Category-based browsing and content discovery
- Search-driven navigation for faster exploration
- Contact form integration for direct email delivery via EmailJS
- Lightweight local content store powered by JSON Server
- Fast development workflow using Vite

## Tech Stack

- React 19
- Vite
- React Router
- EmailJS
- JSON Server
- ESLint

## Project Structure

```bash
.
├── public/
├── src/
│   ├── Components/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── data/
│   └── db.json
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── README.md
├── vite.config.js
└── dist/
```

## Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- Node.js 18 or later
- npm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd blog
```

2. Install the project dependencies:

```bash
npm install
```

3. Create your local environment file for EmailJS:

```bash
cp .env.example .env.local
```

Then update `.env.local` with your EmailJS credentials:

```env
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

4. Start the local JSON data server:

```bash
npm run server
```

5. Launch the frontend development server:

```bash
npm run dev
```

The app will be available through the local Vite URL shown in the terminal output.

## Available Scripts

```bash
npm run dev
```
Starts the Vite development server.

```bash
npm run server
```
Starts JSON Server and serves the blog content from `data/db.json`.

```bash
npm run build
```
Builds the production bundle for deployment.

```bash
npm run preview
```
Serves the production build locally for previewing.

```bash
npm run lint
```
Runs ESLint to maintain code quality and consistency.

## EmailJS Configuration

The contact form sends messages directly through EmailJS, allowing visitors to reach out without opening an external email client.

To enable email delivery:

1. Create an [EmailJS](https://www.emailjs.com/) account.
2. Connect an email service and verify the inbox used for incoming messages.
3. Create a template containing these variables:
   - `{{from_name}}`
   - `{{reply_to}}`
   - `{{subject}}`
   - `{{message}}`
4. Set the template Reply-To field to `{{reply_to}}`.
5. Add the Service ID, Template ID, and Public Key to `.env.local`.
6. Restart the application after saving your environment variables.

Important notes:

- Only use the EmailJS public key in browser-exposed `VITE_` variables.
- Do not place a private key in the frontend environment.
- Restrict allowed origins to your production domain and local development origin.

## Development Notes

- Content is served through JSON Server using `data/db.json`.
- The codebase is structured to support future enhancements such as authentication, CMS integration, or a database-backed backend.

## Contribution

Contributions, improvements, and thoughtful refinements are welcome. Please keep the project consistent with the existing React and Vite architecture and follow the established linting and build conventions.
