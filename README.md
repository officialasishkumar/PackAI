# PackAI

PackAI is a mobile-first luggage checklist app. Users upload a suitcase photo or short MP4, the Go backend sends that media to Gemini for structured item extraction, and the Next.js frontend turns the result into a packing/repacking checklist that stays readable offline after first load.

## Stack

- Frontend: Next.js 16 App Router, React 19, PWA manifest + service worker
- Backend: Go 1.26, `net/http`, Google GenAI SDK, MongoDB driver v2
- Database: MongoDB 8
- Storage: discard raw uploads by default, optional archival to local disk or S3-compatible object storage
- Local orchestration: Docker Compose

## Important note on the Gemini model

The original spec called for `gemini-1.5-flash`. The current Google GenAI SDK/docs center on the newer `google.golang.org/genai` client and current Gemini 2.x models, so the app defaults to `gemini-2.5-flash`. If you need to match the original model exactly, set `GEMINI_MODEL=gemini-1.5-flash`.

## Quick start

1. Copy `.env.example` to `.env`.
2. Set `GOOGLE_API_KEY`.
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

## What changed from the original spec

- The spec allowed either temporary S3 storage or direct Gemini file upload. The app now takes the safer default: uploads are processed and discarded unless you explicitly turn on archival with `MEDIA_RETENTION_MODE=archive`.
- The API now adds request timeouts, per-endpoint rate limits, stricter body limits, security headers, and MongoDB indexes instead of running as an unconstrained demo service.
- Optional archival supports S3-compatible endpoints through `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`, which keeps the project flexible if you later move to a lower-cost object store.

## Environment

Key variables live in `.env.example`.

- `GOOGLE_API_KEY`: required for real Gemini extraction
- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`
- `MEDIA_RETENTION_MODE`: `discard` or `archive`
- `MEDIA_STORAGE_DRIVER`: `local` or `s3`
- `MONGODB_URI`: defaults to local MongoDB / Compose service
- `NEXT_PUBLIC_API_BASE_URL`: browser-facing backend URL
- `CREATE_TRIP_TIMEOUT`, `READ_TRIP_TIMEOUT`, `UPDATE_TRIP_TIMEOUT`: per-endpoint timeout guards
- `CREATE_RATE_LIMIT_PER_MINUTE`, `READ_RATE_LIMIT_PER_MINUTE`, `UPDATE_RATE_LIMIT_PER_MINUTE`: per-IP fixed-window rate limits
- `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_STORAGE_CLASS`: optional settings for S3-compatible providers

## API

- `POST /api/v1/trips`
  - `multipart/form-data` with `trip_name` and `media`
- `GET /api/v1/trips/:id`
- `PUT /api/v1/trips/:id/items`
  - accepts `{ "items": [...], "status": "packing|repacking|completed" }`
  - also tolerates the original spec shape of a raw items array

## Operational notes

- Docker Compose keeps MongoDB on the internal `packai` bridge network instead of publishing port `27017` to the host.
- Archived media storage metadata is retained server-side, but raw storage locations are no longer returned in API responses.
- Offline trip caching is capped to the most recent 20 trips on a device so local storage does not grow without bound.

## Verification

These checks are expected to pass:

```bash
cd backend && go test ./...
cd frontend && npm run lint
cd frontend && npm run build
```
