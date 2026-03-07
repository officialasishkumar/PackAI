# PackAI

PackAI is a mobile-first luggage checklist app. Users upload a suitcase photo or short MP4, the Go backend sends that media to Gemini for structured item extraction, and the Next.js frontend turns the result into a packing/repacking checklist that stays readable offline after first load.

## Stack

- Frontend: Next.js 16 App Router, React 19, PWA manifest + service worker
- Auth: Google sign-in via NextAuth
- Backend: Go 1.26, `net/http`, Google GenAI SDK, MongoDB driver v2
- Database: MongoDB 8
- Storage: discard raw uploads by default, optional archival to local disk or S3-compatible object storage
- Local orchestration: Docker Compose

## Important note on the Gemini model

The original spec called for `gemini-1.5-flash`. The current Google GenAI SDK/docs center on the newer `google.golang.org/genai` client and current Gemini 2.x models, so the app defaults to `gemini-2.5-flash`. If you need to match the original model exactly, set `GEMINI_MODEL=gemini-1.5-flash`.

## Quick start

1. Copy `.env.example` to `.env`.
2. Set `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXTAUTH_SECRET`.
3. Run the backend and frontend locally:

```bash
cd backend && go run ./cmd/api
cd frontend && npm run dev
```

4. Or use Docker Compose once Docker Desktop is running:

```bash
docker compose up --build
```

Frontend runs on `http://localhost:3000`. Backend runs on `http://localhost:8080`.

For Google OAuth locally, configure `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in your Google Cloud app.

## What changed from the original spec

- The spec allowed either temporary S3 storage or direct Gemini file upload. The app now takes the safer default: uploads are processed and discarded unless you explicitly turn on archival with `MEDIA_RETENTION_MODE=archive`.
- Google authentication now owns trip history and dashboard access, so trip lookup and updates are scoped to the signed-in user instead of trusting a browser-supplied `user_id`.
- The API now adds request timeouts, per-endpoint rate limits, stricter body limits, security headers, internal service auth, and MongoDB indexes instead of running as an unconstrained demo service.
- Optional archival supports S3-compatible endpoints through `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`, which keeps the project flexible if you later move to a lower-cost object store.

## Environment

Key variables live in `.env.example`.

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`: required for Google sign-in
- `API_BASE_URL`: server-side URL the Next.js app uses to reach the Go API
- `INTERNAL_API_TOKEN`: shared secret between the Next.js API routes and the Go backend
- `GOOGLE_API_KEY`: required for real Gemini extraction
- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`
- `MEDIA_RETENTION_MODE`: `discard` or `archive`
- `MEDIA_STORAGE_DRIVER`: `local` or `s3`
- `MONGODB_URI`: defaults to local MongoDB / Compose service
- `CREATE_TRIP_TIMEOUT`, `READ_TRIP_TIMEOUT`, `UPDATE_TRIP_TIMEOUT`: per-endpoint timeout guards
- `CREATE_RATE_LIMIT_PER_MINUTE`, `READ_RATE_LIMIT_PER_MINUTE`, `UPDATE_RATE_LIMIT_PER_MINUTE`: per-IP fixed-window rate limits
- `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_STORAGE_CLASS`: optional settings for S3-compatible providers

## API

- `GET /api/v1/trips`
  - returns summary cards for the authenticated user
- `POST /api/v1/trips`
  - `multipart/form-data` with `trip_name` and `media`
  - accepts optional `location_latitude`, `location_longitude`, `location_accuracy_meters`, `location_captured_at`
- `GET /api/v1/trips/:id`
- `PUT /api/v1/trips/:id/items`
  - accepts `{ "items": [...], "status": "packing|repacking|completed" }`
  - also tolerates the original spec shape of a raw items array

## Operational notes

- The browser no longer talks to the Go API directly. It uses authenticated Next.js route handlers, which forward a signed-in Google user id and an internal shared token to the backend.
- Docker Compose keeps MongoDB on the internal `packai` bridge network instead of publishing port `27017` to the host.
- Archived media storage metadata is retained server-side, but raw storage locations are no longer returned in API responses.
- Offline trip caching is capped to the most recent 20 trips on a device so local storage does not grow without bound.
- Trip location sharing is opt-in and stored as rounded approximate coordinates so the dashboard can show place context without keeping high-precision GPS data.

## Verification

These checks are expected to pass:

```bash
cd backend && go test ./...
cd frontend && npm run lint
cd frontend && npm run build
```
