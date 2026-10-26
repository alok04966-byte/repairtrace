# RepairTrace

The current milestone provides customer registration and login APIs only; no frontend, logout, profile, repair, quotation, or status features are included yet.

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

## Staff provisioning

Public registration can create customers only. To create a staff account, set the optional `STAFF_*` values in the ignored `backend/.env` file, then run:

```powershell
cd backend
npm run provision:staff
```

The script validates the values, hashes the password, creates only a new staff account, and refuses to change an existing account.

## Tests

```powershell
cd backend
npm test
```

Tests use `mongodb-memory-server`, which starts an isolated temporary MongoDB instance and does not read `backend/.env` or access the application database. Its first run may download a MongoDB binary; allow that download or configure its documented binary cache if your network blocks it.
