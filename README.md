# Exhibitor Registration

A complete React + TypeScript + Tailwind CSS frontend with a Node.js + Express API and Gmail SMTP delivery through Nodemailer. Original uploaded AIFOM and BHARAT Wellness logos are included. AIFOM appears at the top-left under “Sponsored By”; BHARAT Wellness appears at the top-right.

## Requirements

- Node.js 22.13+ (Node 24 LTS recommended) and npm.
- Gmail account with 2-Step Verification and an App Password enabled by your account policy.
- A receiving email address and outbound SMTP connectivity from the server.

## Quick start

1. Extract the ZIP and open a terminal in `exhibitor-registration`.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` in the project root:
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS / Linux: `cp .env.example .env`
4. Set `DATABASE_URL` to your Neon Postgres connection string, including its SSL parameters. Set the Gmail account, App Password, and receiving email in the same file.
5. Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` of at least 16 characters in `.env`.
6. Run `npm run dev` and open http://localhost:5173.

The frontend runs on port 5173; Vite proxies `/api` to Express on port 4000. Run commands from the project root. If you change PORT, update the Vite proxy too. Do not open index.html directly.

## Admin and exhibitor workflow

1. Open `http://localhost:5173/admin` in development or `/admin` on the deployed site. Sign in using the server-side credentials in `.env`.
2. Select participation interest, booth type, booth size and stall number. Create the invitation and use **Copy ID** to share it privately with the exhibitor.
3. The exhibitor opens the public form, enters the ID under **Complete registration with ID**, and loads the assigned details. The four assigned fields are read-only. The exhibitor fills the remaining details and submits.
4. Open the invitation in the admin dashboard to view the submitted data, or select **Download CSV** to export completed ID registrations and general enquiries.

A stall can have one pending invitation or one completed registration. Staff can revoke a pending invitation to release its stall. Treat IDs as private, single-use credentials. The public enquiry form saves preferences without claiming any stall. The CSV includes a Source column to distinguish general enquiries from completed ID registrations.

On startup, the server connects to Neon using `DATABASE_URL`, creates the required tables, and seeds the existing form options. Use a database role with permission to create these tables. Keep the connection string on the server. Existing SQLite records are not copied to Neon by this release.

| Capability | Admin | Registration staff |
| --- | --- | --- |
| Create and revoke pending invitations, view submissions, export CSV | Yes | Yes |
| Add, archive, and reactivate stall numbers, booth sizes, booth types, and participation interests | Yes | |
| Create, disable, and reactivate registration staff accounts | Yes | |

The primary admin signs in using `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Staff sign in at the same `/admin` page using credentials created in the dashboard. Sign in again after refreshing the page. Archive an option and add its replacement to change the label for future submissions. Saved registrations and invitations retain their assigned values.

Completed registrations and general enquiries are saved before Gmail notifications are attempted. The dashboard and CSV show the saved records even if Gmail delivery fails.

## Gmail SMTP setup

Enable Google 2-Step Verification, create an App Password, and paste its 16 characters without spaces into `SMTP_PASS`. Use your complete Gmail address for `SMTP_USER`. Do not use your regular Gmail password. App Passwords may be unavailable for some managed accounts or security configurations; ask your administrator if necessary.

Set:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password-without-spaces
MAIL_FROM_NAME=BHARAT Wellness Exhibitor Registration
MAIL_TO=your-receiving-email@example.com
```

Alternatively use port 587 with `SMTP_SECURE=false`; STARTTLS is required. TLS certificate validation remains enabled. Sender uses the authenticated Gmail account; Reply-To uses the validated applicant email. The recipient is read only from server configuration and cannot be supplied through the form. One receiving address is supported.

Official references:
- https://nodemailer.com/guides/using-gmail
- https://nodemailer.com/smtp
- https://support.google.com/accounts/answer/185833

## Included form fields

Interested to Participate In; Booth Type; Booth Size; Describe Your Business Nature; Website Link; Full Name; Company Name; Email; Contact Number; Country; Designation; City; Special Requirements; Additional Message; consent checkbox.

Website Link, Special Requirements and Additional Message are optional. All other visible fields are required. Country is free text so all countries are supported. Phone numbers accept international formats with 7–15 digits. Website links must start with http:// or https://.

Participation choices and booth sizes are configurable examples, not confirmed event inventory. Edit `options` in `shared/form.js` to use your final event choices. This updates both client and server validation. Change the consent statement in `src/App.tsx` to match your organisation’s approved wording if needed.

## Build and production

```sh
npm test
npm run build
npm start
```

Before production, set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://your-domain.com` (without trailing slash), and your actual SMTP settings. Express serves the built frontend from `dist` and the API on the configured PORT. Use a Node-capable hosting service or VPS and terminate HTTPS at your host/reverse proxy. Deploy the frontend and API under the same public origin; no CORS setup is needed. A static frontend-only host cannot run this Express API.

Keep `TRUST_PROXY_HOPS=0` for direct access. Behind exactly one trusted reverse proxy set it to `1`, ensure that the proxy overwrites forwarded headers, and prevent users from reaching the backend directly. Use an exact trusted proxy configuration for more complex networks. Incorrect settings affect IP rate limiting.

`GET /api/health` checks the running HTTP service, not Gmail connectivity. `POST /api/registrations` requires JSON and a matching browser Origin. For command-line testing, set the Origin header to PUBLIC_ORIGIN. A 201 response means the submission was saved in Neon.

## Security and behavior

- Shared Zod schema validates browser and API submissions, lengths, selections, URLs, email, phone and consent.
- Server rejects unexpected fields; recipient and sender cannot be overridden by a submission.
- Gmail credentials remain server-only. Never prefix secrets with `VITE_`, commit `.env`, or include it in a frontend bundle.
- Helmet headers, a 24 KB request limit, same-origin checks, a hidden spam field and a limit of 5 attempts per IP per 15 minutes are included.
- The rate limiter is in-memory for a single Node process. For multiple instances, add a shared store such as Redis. For a busy public campaign, add a verified bot challenge at both client and server.
- Email contains a reference, all form fields, consent confirmation, plain text and escaped HTML. Submissions save first and the server attempts email notification after responding.
- Invitations, completed registrations, general enquiries, options, and staff accounts are stored in Neon Postgres. Set retention policies for both the database and receiving mailbox.
- SMTP notification failures are logged with the submission reference. Check the dashboard for saved submissions before asking the exhibitor to retry.
- Credentials are validated at startup, but SMTP authentication is exercised only when sending a registration.

## Project structure

```text
exhibitor-registration/
  public/assets/          Original AIFOM and BHARAT Wellness logos
  src/                    React TypeScript UI and Tailwind styles
  shared/form.js          Shared choices, labels and validation
  server/app.js           Express routes and request protections
  server/config.js        Environment validation
  server/mail.js          Gmail transport and email templates
  server/index.js         Startup and graceful shutdown
  server/app.test.js      API and security checks with injected mailer
  .env.example            Safe configuration template
  package-lock.json       Reproducible dependency versions
  vite.config.ts          React/Tailwind build and API proxy
```

## Troubleshooting

- Invalid configuration: check every required `.env` entry and start from the project root.
- Gmail authentication failure: verify the full email and App Password; changing your Google password may revoke App Passwords.
- Connection timeout: confirm your host allows outbound TCP 465 or 587.
- 403 response: PUBLIC_ORIGIN must exactly match the address in the browser (scheme, hostname and port).
- 429 response: wait 15 minutes, and verify trusted proxy configuration.
- Port 5173 already in use: stop the other process or explicitly change Vite's port and PUBLIC_ORIGIN together.

## Validation

Run `npm test` for validation, recipient override protection, origin checks, SMTP failure, malformed requests, HTML escaping and rate limiting. Tests inject a mailer and do not send real email. Run `npm run build` for TypeScript and the production frontend build. The database workflow tests run on local PostgreSQL through PGlite. Live Neon and Gmail connections require your credentials and have not been exercised in the supplied package.

Package verification: production build and all 8 automated tests passed. Browser layout verification was unavailable because the browser download failed in the generation environment.
