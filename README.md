# RepairTrace

The current milestone provides only a customer-registration API; no frontend, login, repair, quotation, or status features are included yet.

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

Set `MONGODB_URI` in `backend/.env` before starting the server. `PORT` defaults to `5000` when omitted. Do not commit `.env`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string for the application database. |
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

## Tests

```powershell
cd backend
npm test
```

Tests use `mongodb-memory-server`, which starts an isolated temporary MongoDB instance and does not read `backend/.env` or access the application database. Its first run may download a MongoDB binary; allow that download or configure its documented binary cache if your network blocks it.
