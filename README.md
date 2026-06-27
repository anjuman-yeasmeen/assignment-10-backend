# MediCare Connect — Server (Express + MongoDB)

REST API for **MediCare Connect**, a hospital appointment & healthcare management platform. It handles authentication, doctor profiles & verification, appointments, payments, reviews, prescriptions, and admin analytics.

> Frontend (Next.js) lives in a separate repository: **medicare-nextjs**.

## Tech Stack

- **Node.js + Express 5**
- **MongoDB** (native `mongodb` driver, MongoDB Atlas)
- **JWT** authentication (httpOnly cookie + `Authorization: Bearer` support)
- **bcryptjs** password hashing
- **cors**, **cookie-parser**, **dotenv**

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in values (see below)
npm run seed           # optional: create admin, sample doctors, patient, reviews
npm run dev            # http://localhost:5001
```

> Port **5001** is the default because macOS ControlCenter (AirPlay) occupies port 5000.

### Environment Variables

| Variable | Description |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `MONGO_DB` | Database name (default `medicare`) |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `PORT` | Server port (default `5001`) |
| `NODE_ENV` | `development` / `production` (controls secure cookie flags) |
| `CLIENT_ORIGINS` | Comma-separated allowed CORS origins (credentials enabled) |

### Seed Credentials

After `npm run seed`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@medicare.com` | `Admin@123` |
| Doctor | `dr.sarah.lin@medicare.com` (and others) | `Doctor@123` |
| Patient | `patient@medicare.com` | `Patient@123` |

## Project Structure

```
src/
├── config/db.js              # Single shared Mongo client + collection accessors
├── middleware/auth.js        # signToken / verifyToken / requireRole
├── utils/helpers.js          # asyncHandler, toObjectId
├── routes/
│   ├── auth.routes.js        # register, login, social, me, logout
│   ├── users.routes.js       # admin user management + self profile
│   ├── doctors.routes.js     # search/sort/pagination, featured, verify
│   ├── appointments.routes.js
│   ├── reviews.routes.js
│   ├── payments.routes.js    # auto-pay + records
│   ├── prescriptions.routes.js
│   └── stats.routes.js       # public stats + admin analytics
├── seed.js
└── server.js
```

## Authentication & Authorization (JWT)

Authentication uses **JSON Web Tokens**. The flow:

1. On **register / login / social login**, the server verifies credentials, signs a JWT containing `{ id, email, role }` (7-day expiry), and sets it as an **httpOnly cookie** named `token`. The token is also returned in the JSON body.
2. The httpOnly cookie means the browser stores the token where JavaScript cannot read it (mitigating XSS token theft), and it is sent automatically on every request — so **users stay authenticated after a page reload**.
3. Protected routes use the **`verifyToken`** middleware, which reads the token from the `token` cookie **or** an `Authorization: Bearer <token>` header, verifies the signature, and attaches `req.user`.
4. **Role-based authorization** is enforced by **`requireRole(...roles)`**, applied after `verifyToken`. For example, only `admin` can verify doctors or manage users; only `patient` can book appointments and pay; only `doctor` can manage their profile and prescriptions.

```js
// Example: admin-only endpoint
router.patch("/:id/verify", verifyToken, requireRole("admin"), handler);
```

Unauthorized requests receive **401**; authenticated-but-wrong-role requests receive **403**.

## API Overview

All routes are prefixed with `/api`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register (patient/doctor); strong-password validated |
| POST | `/auth/login` | Public | Email/password login |
| POST | `/auth/social` | Public | Google/OAuth upsert login |
| GET | `/auth/me` | Auth | Restore session (used after reload) |
| POST | `/auth/logout` | Auth | Clear cookie |
| GET | `/doctors` | Public | List with `search`, `specialization`, `sort`, `page`, `limit` |
| GET | `/doctors/featured` | Public | Featured verified doctors |
| GET | `/doctors/:id` | Public | Doctor details |
| POST | `/doctors` | Doctor | Create/update own profile (starts `pending`) |
| PATCH | `/doctors/:id/verify` | Admin | verify / reject / unverify |
| GET/POST | `/appointments` | Auth/Patient | List (role-scoped) / book |
| PATCH | `/appointments/:id` | Patient | Reschedule / cancel |
| PATCH | `/appointments/:id/status` | Doctor | accept / reject / complete |
| POST | `/payments/pay` | Patient | Auto-pay an appointment |
| GET | `/payments` | Patient/Admin | Payment records |
| GET/POST/PATCH/DELETE | `/reviews` | Public/Patient | Review CRUD |
| GET/POST/PATCH | `/prescriptions` | Auth/Doctor | Prescription management |
| GET | `/stats/public` | Public | Home-page platform statistics |
| GET | `/stats/admin` | Admin | Analytics incl. doctor performance |

## Notes

- **Payments** use a simplified **auto-pay** model (click-to-pay → instantly recorded with a generated `transactionId`); no external card gateway.
- Mongo connects once at boot before the server accepts traffic.
