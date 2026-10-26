# RepairTrace

The current backend milestone includes customer authentication, staff-controlled repair intake, diagnosis, versioned quotations, approval decisions, and the initial repair-progress lifecycle. There is no frontend yet.

## Prerequisites

- Node.js LTS (20 or later)
- MongoDB running locally or a MongoDB connection string you control

## Setup

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Set `MONGODB_URI` and a long, random `JWT_SECRET` in `backend/.env` before starting the server. `PORT` defaults to `5000` when omitted. Do not commit `.env`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string for the application database. |
| `JWT_SECRET` | Yes | Long random secret used to sign authentication tokens. |
| `STAFF_NAME` | Only for provisioning | Name for the staff account created by the CLI. |
| `STAFF_EMAIL` | Only for provisioning | Email for the staff account created by the CLI. |
| `STAFF_PHONE` | Only for provisioning | E.164 phone number for the staff account created by the CLI. |
| `STAFF_PASSWORD` | Only for provisioning | Strong password for the staff account created by the CLI. |
| `STAFF_PROVISION_MODE` | Only for provisioning | `create` (default) creates a new staff account; explicit `promote` promotes the existing `STAFF_EMAIL` customer. |
| `PORT` | No | API listener port; defaults to `5000`. |

## API

`GET /api/health` returns `200` when MongoDB is connected, otherwise `503` with the reported database state.

`POST /api/auth/register` creates a customer account. Example body:

```json
{
  "name": "Example Customer",
  "email": "customer@example.com",
  "phone": "+919876543210",
  "password": "Example-Password-123"
}
```

Names are trimmed, emails are lowercased, and phone numbers must be valid E.164 international numbers. The server hashes passwords with bcryptjs, rejects role input, and always assigns `customer`. Successful responses contain only safe user fields. A normalized duplicate email returns `409`.

`POST /api/auth/login` accepts `email` and `password`. Email is trimmed and lowercased before lookup. Valid credentials set a seven-day `auth_token` HttpOnly cookie (`SameSite=Lax`; `Secure` in production) and return only safe user fields. Incorrect credentials always return the same `401` response. The JWT is not returned in the response body.

`GET /api/auth/me` requires the `auth_token` cookie and returns only the authenticated user's safe profile fields. Missing, invalid, expired, or stale-user tokens return a safe `401` response.

`POST /api/repairs` is staff-only and creates a device and repair order for an existing customer. `GET /api/repairs` returns all repair orders to staff and only the authenticated customer's own repairs to customers. `GET /api/repairs/:id` applies the same ownership restriction. The server assigns an atomic, increasing numeric repair number and returns a display reference such as `RT-000001`.

### Diagnosis, quotations, and progress

All routes below require the `auth_token` cookie. Staff-only routes reject customers; customer quote decisions reject staff.

- `PATCH /api/repairs/:id/diagnosis` (staff) records a required diagnosis and optional internal `diagnosisNotes`. A diagnosis starts `diagnosing`. Changing it supersedes any existing quotation and requires a new approval.
- `POST /api/repairs/:id/quotes` (staff) creates the next quotation version after diagnosis. Send `items`, each with `description`, positive integer `quantity`, and a nonnegative INR `unitPrice` with no more than two decimal places. Totals are calculated as integer paise on the server.
- `GET /api/repairs/:id/quotes` returns quote history to staff or the repair's owning customer.
- `POST /api/repairs/:id/quotes/:version/decision` (owning customer) accepts `{ "decision": "approved" }` or `{ "decision": "declined" }` only for the latest pending version. Approval starts work unless a parts blocker exists; decline returns the repair to `diagnosing`.
- `PATCH /api/repairs/:id/status` (staff) supports only `{ "status": "awaiting_parts", "reason": "..." }` from approved `in_progress`, and `{ "status": "in_progress", "resolutionNote": "..." }` from `awaiting_parts`.

Repair details include quotation and audit history. Customers receive only their own repair and customer-safe history; internal diagnosis notes remain staff-only.

Example quote request body:

```json
{
  "items": [
    { "description": "Replacement screen", "quantity": 1, "unitPrice": "1250.50" },
    { "description": "Labour", "quantity": 1, "unitPrice": 250 }
  ]
}
```

## Staff provisioning

Public registration can create customers only. To create a staff account, set `STAFF_PROVISION_MODE=create` plus `STAFF_NAME`, `STAFF_EMAIL`, `STAFF_PHONE`, and `STAFF_PASSWORD` in the ignored `backend/.env` file, then run:

```powershell
cd backend
npm run provision:staff
```

The script validates the values, hashes the password, creates only a new staff account, and refuses to change an existing account. To explicitly promote an existing customer without changing their password, set `STAFF_PROVISION_MODE=promote` and `STAFF_EMAIL`, then run the same command. It never promotes an account unless that mode is set.

## Tests

```powershell
cd backend
npm test
```

Tests use `mongodb-memory-server`, which starts an isolated temporary MongoDB instance and does not read `backend/.env` or access the application database. Its first run may download a MongoDB binary; allow that download or configure its documented binary cache if your network blocks it.
