# Festival API

NestJS API for the festival ticket catalog and Paystack checkout. PostgreSQL stores ticket types and orders; Paystack is responsible for handling payment details.

## Local setup

1. Run `yarn install` from the repository root for the website, then run `yarn install` in `backend/` for the API.
2. Create a PostgreSQL database and copy `backend/.env.example` to `backend/.env`.
3. Set `DATABASE_URL`, `FRONTEND_URL`, and a Paystack **test** secret key in `backend/.env`. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `TICKETS_FROM_EMAIL` to email ticket PDFs; set `SMTP_SECURE=true` when your provider requires implicit TLS (usually port 465). Set `PUBLIC_API_URL` to the public API base URL so ticket QR codes open the validation endpoint.
   Set `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD` (at least 12 characters), and a unique random `ADMIN_SESSION_SECRET` (at least 32 characters) to enable the admin dashboard.
4. Copy the root `.env.example` to `.env.local` for the Next.js app.
5. Run `yarn db:generate`, `yarn db:migrate`, and `yarn db:seed` to apply the checked-in migrations and create the ticket catalog.
6. Start the API with `yarn backend:dev` and the website with `yarn dev` in separate terminals.

The API listens on port `6001` by default and uses the `/api` prefix. The Paystack webhook endpoint is `POST /api/payments/webhook`; configure that URL in the Paystack dashboard. Use the same `PAYSTACK_SECRET_KEY` for checkout verification and webhook signature validation.

Interactive API documentation is available at `http://localhost:6001/api/docs`; the OpenAPI JSON and YAML documents are at `/api/docs-json` and `/api/docs-yaml`.

The admin dashboard is at `http://localhost:3000/admin`. It uses an HTTP-only, signed session cookie; admin endpoints are not available without signing in. The dashboard provides paid-sales and order summaries, searchable/paginated orders, and ticket type create, edit, and archive actions. Admins can set a total slot capacity or leave it blank for unlimited slots; current sold, reserved, and available totals are shown. Checkout reserves slots for 30 minutes and releases unpaid reservations when the ticket catalog, checkout, or payment verification is accessed. Archived tickets remain in the database so past orders retain their ticket references.

Generate a signing secret with `openssl rand -base64 48`. Keep the admin password and session secret private, and use HTTPS in production.

## Docker (AMD64)

The repository root `Dockerfile` builds the Next.js frontend as `northern-kenya-festival-frontend:latest`; `backend/Dockerfile` builds the API as `northern-kenya-festival-backend:latest`. Both images target `linux/amd64`. Docker Compose builds and runs them separately:

1. Copy `backend/.env.example` to `backend/.env` and set the API/database/payment/admin settings. For PostgreSQL on the host machine, use `host.docker.internal` in `DATABASE_URL` instead of `localhost`.
2. Build and start with `docker compose up --build -d`.
3. Apply database migrations with `docker compose --profile tools run --rm migrate` before serving traffic.
4. Open the frontend at `http://localhost:3000` and API docs at `http://localhost:6001/api/docs`.

The browser-facing API URL is baked into the frontend image at build time from the root `.env` file. Set `NEXT_PUBLIC_API_URL=/api` there; Next.js proxies `/api/*` requests to the `backend` Compose service so browser requests remain same-origin. For production, set `FRONTEND_URL` in `backend/.env` to the frontend origin(s), comma-separated (for example `https://gnf.northernbox.org`), and set `PUBLIC_API_URL` to the public API base URL (for example `https://gnf.northernbox.org/api`). Keep only the public API URL in the root `.env`; do not put secrets there. The Docker build removes the root `.env` from the generated standalone output.

## Endpoints

- `GET /api/tickets` — list active ticket types with prices in KES minor units.
- `POST /api/payments/initialize` — validate buyer details, calculate the amount from the database, create a pending order, then return Paystack's hosted checkout URL.
- `GET /api/payments/verify/:reference` — verify a transaction directly with Paystack and mark the order paid only when reference, amount, currency, and email match.
- `GET /api/payments/ticket/:reference/download` — download the paid order's PDF ticket.
- `GET /api/payments/ticket/:reference/validate` — validate the ticket QR code; successful results contain only the ticket name, quantity, and reference.
- `POST /api/payments/webhook` — validate Paystack's SHA-512 signature and reconcile successful charges.

After payment is confirmed, the API emails a PDF ticket attachment with a QR code to the buyer. If email delivery is temporarily unavailable, the confirmation page still offers the PDF download and later payment verification retries delivery.
- `POST /api/admin/auth/login` and `POST /api/admin/auth/logout` — start and end the admin session.
- `GET /api/admin/dashboard` and `GET /api/admin/orders` — view verified sales, recent orders, and filtered/paginated orders.
- `GET|POST /api/admin/tickets`, `PATCH /api/admin/tickets/:id`, and `DELETE /api/admin/tickets/:id` — manage ticket types; delete archives a ticket rather than removing its order history.

Admin sessions use an HTTP-only cookie and are limited to eight hours. Login is rate-limited; admin requests with a browser origin must come from `FRONTEND_URL`.

Ticket prices are seeded from the current site: Student KES 400, Regular KES 500, VIP KES 2,000, and VVIP KES 5,000. Amounts sent to Paystack are in the currency's minor unit; the backend never accepts a price from the browser.
