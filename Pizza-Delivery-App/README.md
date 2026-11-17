# Pizza Delivery & Inventory App (MERN starter)

A teaching/demo full-stack starter using React + Vite, Node/Express, MongoDB/Mongoose, JWT, email verification/reset links, Razorpay test checkout, an admin inventory/order dashboard, low-stock email checks, and polling for order updates.

> This is a learning project / MVP scaffold, not a production-ready commerce system. Before real use, add HTTPS, secure httpOnly cookie sessions (or a robust token strategy), CSRF protection as appropriate, webhook reconciliation, refunds, audit logs, stronger rate limits, monitoring, backups, and a reviewed transactional inventory/payment workflow. Never commit real secrets.

## Prerequisites

- Node.js 20.19+ or 22.12+ (current Vite requirement)
- npm
- MongoDB local instance or MongoDB Atlas connection string
- Razorpay test-mode API key ID and secret for checkout
- SMTP credentials for email verification, password reset, and low-stock alerts (optional in development; links are logged / returned in non-production mode)

## Setup

1. Open this `pizza-delivery-app` folder in VS Code.
2. Copy `server/.env.example` to `server/.env` and fill in `MONGODB_URI`, `JWT_SECRET`, and Razorpay test keys. Add SMTP settings for real email delivery.
3. In a terminal at the project root, run:

   ```bash
   npm install
   npm run install:all
   ```

4. Start MongoDB.
5. Run the app:

   ```bash
   npm run dev
   ```

6. Frontend: http://localhost:5173  |  API health: http://localhost:5000/api/health
7. Register as a customer. In development without SMTP, the registration response includes a verification URL in the page message / server console. Open it to verify, then log in.
8. To create an admin login, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `server/.env`, restart the server, then use the **Admin login** link. Admin is seeded separately and cannot be created through customer registration.

## Razorpay test checkout

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to your Razorpay **test-mode** keys. The server creates a Razorpay order; the browser Checkout returns payment IDs/signature; the server verifies the HMAC signature before marking the order paid. Use Razorpay's test payment details from its official documentation. A missing test key configuration disables checkout rather than faking a successful payment.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `ADMIN_NOTIFICATION_EMAIL`. Without SMTP in development, the API returns the verification/reset URL so you can test the flow manually. Do not expose those development URLs in production.

## Main API routes

- `POST /api/auth/register`, `GET /api/auth/verify-email?token=...`
- `POST /api/auth/login`, `POST /api/auth/admin/login`, `GET /api/auth/me`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET /api/orders/catalog`, `POST /api/orders`, `POST /api/orders/:id/verify-payment`, `POST /api/orders/:id/cancel`, `GET /api/orders/mine`
- Admin JWT required: `GET /api/admin/inventory`, `PATCH /api/admin/inventory/:id`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`

## Important implementation notes

- Customer and admin roles are enforced on the server, not just hidden in the UI.
- Stock decrements at order creation to reserve ingredients. If the checkout is dismissed/failed, the client calls the cancel endpoint to release stock. A scheduled server-side job expires unpaid pending orders after the configured timeout and releases reserved stock. Production still requires Razorpay webhooks to reconcile payment state reliably.
- Stock reservation uses conditional atomic `findOneAndUpdate` updates and compensating rollback if a later reservation step fails. For stronger multi-document guarantees use a MongoDB replica set / Atlas and Mongoose transactions.
- Customer order screens poll every 8 seconds for updates. Replace polling with authenticated WebSockets if needed.
- Ingredient prices and stock are read from MongoDB on the server; client totals are only for display.
