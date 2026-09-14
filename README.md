# Irzz.Maths.LK — Online Mathematics Learning Platform

Teacher: **G. Iranga Sathsara** · Colombo University CS Undergraduate · 078 294 4774
Brand colors: **#FF9900** (orange) + **#000000** (black)

This project has two parts:

```
irzz-maths/
├── frontend-demo/
│   └── index.html          ← Working, self-contained demo (open in any browser, no install)
├── backend/                 ← Real Node.js + Express API (needs MySQL + an SMS provider)
│   ├── config/db.js
│   ├── middleware/auth.js
│   ├── routes/               (auth, courses, content, quizzes, misc, admin)
│   ├── scripts/create-admin.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── database/
│   └── schema.sql            ← Full MySQL schema + sample courses/announcements
└── README.md
```

## 1. What you have right now

**`frontend-demo/index.html`** is a fully working, mobile-responsive demo of every
page in the spec — home, about, courses, video lessons, notes, assignments,
online tests (auto-marked), student login with a simulated OTP step, student
dashboard, profile, results with a progress chart, class schedule,
announcements, contact, and a teacher/admin panel with CRUD for students,
courses, tests, results, schedule and announcements. It runs entirely in the
browser with in-memory sample data — open it and click around, no setup
needed. Because it's demo-only, closing or refreshing the tab resets the data,
and OTP codes are shown on screen (clearly marked "Demo mode") instead of
being sent by SMS.

**`backend/` and `database/schema.sql`** are the real, working server code for
production: MySQL tables, JWT-based sessions, bcrypt password hashing, an OTP
login flow that emails/SMSes a code instead of showing it, rate limiting, and
role-based access so students can never reach admin routes. To go from demo
to a real deployed site, follow the steps below.

## 2. Install dependencies

```bash
cd backend
npm install
```

## 3. Create the database

Install MySQL 8+ if you don't have it, then:

```bash
mysql -u root -p < ../database/schema.sql
```

Create a dedicated app user rather than using root in production:

```sql
CREATE USER 'irzz_app'@'%' IDENTIFIED BY 'a_strong_password';
GRANT ALL PRIVILEGES ON irzz_maths_lk.* TO 'irzz_app'@'%';
FLUSH PRIVILEGES;
```

## 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in real values for:
- `DB_USER` / `DB_PASSWORD` — the MySQL user you just created
- `JWT_SECRET` / `COOKIE_SECRET` — long random strings (e.g. `openssl rand -hex 32`)
- `SMS_API_URL` / `SMS_API_KEY` / `SMS_ACCOUNT_ID` / `SMS_SENDER_ID` — from your chosen SMS OTP provider (see step 5)
- `FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_PASSWORD` — used once, then remove them from `.env`

Never commit `.env` — only `.env.example` (with placeholders) belongs in version control.

## 5. Configure the SMS OTP provider

`backend/utils/sms.js` is a thin wrapper that POSTs to `SMS_API_URL`. Pick a
legitimate, licensed SMS aggregator that supports Sri Lankan numbers, get an
API key/account ID/sender ID from them, and put those in `.env`. If their API
shape differs from the placeholder body in `sms.js`, adjust that one file —
nothing else needs to change.

## 6. Run the backend

```bash
npm run dev     # auto-restarts on changes (nodemon)
# or
npm start
```

The API runs on `http://localhost:5000` by default (`PORT` in `.env`).

## 7. Create the first admin account

```bash
node scripts/create-admin.js
```

This reads `FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_PASSWORD` from `.env` and
creates the teacher/admin row (with the contact details from this brief
already filled in). Log in once, then remove those two lines from `.env`.

## 8. Connect a real frontend to the API

The `frontend-demo/index.html` file simulates the backend in JavaScript so it
can run standalone. To wire a production frontend (e.g. a React app built
with Vite or Create React App) to the real API:

- Point requests at `http://localhost:5000/api/...` in development and your
  deployed API URL in production.
- Send `credentials: 'include'` on fetch/axios calls so the httpOnly JWT
  cookie is sent.
- Match the endpoints already built:
  - `POST /api/auth/register`, `/request-otp`, `/verify-otp`, `/admin-login`, `/logout`
  - `GET/POST/PUT/DELETE /api/courses`
  - `GET/POST/DELETE /api/lessons`, `/api/notes`, `/api/assignments`
  - `GET/POST /api/quizzes`, `POST /api/quizzes/:id/submit`
  - `GET /api/results`, `/api/schedule`, `/api/announcements`
  - `/api/admin/students` (teacher-only)

If you'd rather ship the existing single-file frontend as-is while you build
a full React app later, you can serve it directly from Express with
`express.static`, or host it on any static host and point it at the deployed
API origin.

## 9. Deploying

1. **Database:** managed MySQL (PlanetScale, RDS, or a VPS with MySQL installed).
2. **Backend:** any Node host (Render, Railway, a VPS with PM2 + nginx). Set
   all `.env` values as environment variables on the host — never upload the
   `.env` file itself.
3. **Frontend:** if you build a separate React app, deploy it to Vercel/
   Netlify and set `CLIENT_ORIGIN` in the backend's `.env` to that URL.
4. **HTTPS:** required in production — the auth cookie is set `secure: true`
   whenever `NODE_ENV=production`, so it will only be sent over HTTPS.
5. **Custom domain:** point `Irzz.Maths.LK`'s DNS (A/CNAME record) at your
   frontend host, and use a subdomain like `api.irzz.maths.lk` for the backend.

## 10. Security checklist already implemented

- Passwords hashed with bcrypt (cost factor 12)
- OTP codes hashed before storing, with expiry, attempt limits and resend
- JWT stored in an httpOnly, sameSite cookie — never in frontend JS/localStorage
- Role-based middleware (`requireRole('teacher')`) blocking students from every admin route
- Rate limiting on OTP request/verify and globally on the API
- `helmet` for secure HTTP headers, parameterised SQL everywhere (no string-built queries)
- All secrets (DB password, JWT secret, SMS API key) read from environment variables only

## 11. What to build out next

The route files include the full CRUD pattern for every resource in the
brief. Two things are intentionally left for you to finish because they
depend on choices only you can make:
- **File storage for notes/PDFs:** wire up `multer` + a storage provider (S3,
  or a private local folder served through an authenticated route) and set
  `file_url` when creating a note.
- **Video hosting:** `lessons.video_url` expects a URL — host videos on
  YouTube (unlisted), Vimeo, or your own storage, and paste the URL in.
