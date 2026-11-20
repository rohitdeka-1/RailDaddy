# RailSathi

## Run locally

Use Node.js 24 and start PostgreSQL with `docker compose -f Backend/compose.yml up -d postgres`.
In `Backend/.env`, set `DATABASE_URL` for that database and set `JWT_SECRET` to the output of
`openssl rand -hex 32`. The backend defaults to port 8080.

From `Backend`, run these commands.

```sh
npm ci
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run dev
```

In a second terminal, go to `Frontend`, run `npm ci` and `npm run dev`, then open the
URL Vite prints. Start at `/signup` to create an account or `/login` to sign in.
Set `RAIL_API` in `Backend/.env` to enable RailRadar station suggestions, train schedules, and connecting journeys.
Set `RAILCORE_API` in `Backend/.env` with a RailCore key that has `availability:read` to check seats and quoted fares for direct trains and individual connection legs.
To enable custom Ask Daddy AI questions, set `GOOGLE_API_KEY` and `GEMINI_CHAT_MODEL` in `Backend/.env` and restart the backend.
Quick answers work without Gemini.
Vite forwards `/api` to the backend. Set `API_PROXY_TARGET` when using a different port.
In production, run `npm run build` and `npm start` from `Backend`. Serve the frontend and proxy
`/api` to Express on the same HTTPS origin.

## Where to start in the backend

- `Backend/src/server.ts` connects to PostgreSQL and starts the HTTP server.
- `Backend/src/app.ts` creates the Express app and lists the API prefixes.
- The backend runs as one Express app. Each feature has its own folder under `Backend/src/modules`.
- Each module's router tells Express which function runs for a URL and HTTP method. For example,
  `routes/auth.routes.ts` registers `router.post("/login", ...)`, so Express calls the login function for
  a `POST` to `/api/v1/auth/login`.
- In the auth module, `controllers/auth.controller.ts` reads the form and sends the HTTP response.
  `auth.schemas.ts` defines the required fields, and `services/auth.service.ts` creates accounts and checks passwords.
- `Backend/src/middleware/auth.ts` checks the JWT before the profile handler runs.

## How sign-in works

1. The React page collects your email and password. `Frontend/src/lib/auth.ts` sends the form as JSON.
2. `Backend/src/app.ts` puts the routes in `routes/auth.routes.ts` under `/api/v1/auth`. The signup route creates a user and saves a password hash. The login route checks the submitted password against that hash.
3. Both routes put a signed JWT in an HTTP-only cookie. The browser automatically sends this cookie when it asks for `/api/v1/users/me`. The backend checks the token and uses the user ID inside it to look up the profile.
4. Signing out clears the cookie. A session expires after one hour.

Sign-in uses a separate email field so updating a profile email does not change the login.
Existing profiles are kept in the database. Users from the previous sign-in system must create a password account, which starts a new profile.
