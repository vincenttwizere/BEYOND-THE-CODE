# X-Blog

## Contact form email delivery

The contact form sends messages directly through EmailJS; visitors do not need to open their email app. To enable delivery:

1. Create an [EmailJS](https://www.emailjs.com/) account, connect an email service, and verify the destination inbox (`vincenttwizere12@gmail.com`).
2. Create an EmailJS email template with the recipient set to that inbox. Use `{{from_name}}`, `{{reply_to}}`, `{{subject}}`, and `{{message}}` as the template variables. Set the template's Reply-To field to `{{reply_to}}`.
3. Copy `.env.example` to `.env.local` and replace the sample values with the EmailJS Service ID, Template ID, and Public Key.
4. Restart the Vite development server after adding the environment variables.

The EmailJS public key is intended for browser use. Never put an EmailJS private key in a `VITE_` variable. Restrict the EmailJS allowed origins to the deployed site and local development origin.

## Development

- `npm run dev` starts the Vite development server.
- `npm run server` starts JSON Server for the blog data.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
