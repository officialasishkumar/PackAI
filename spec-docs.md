
# Product Requirements & Technical Specification: "PackSnap"

## 1. Product Overview

PackSnap is a mobile-first web application designed to eliminate packing and repacking anxiety. Users upload a photo or short video of their packed luggage, and the system utilizes a multimodal AI (Gemini 1.5 Flash) to automatically detect, categorize, and log all visible items. This generates an interactive checklist used to ensure no items are left behind during the return trip.

## 2. Core Features (v1 Final)

* **Media Ingestion:** Support for image (JPEG, PNG) and short video (MP4, up to 15 seconds) uploads.
* **AI Extraction:** Automated identification of items, mapped to standardized categories (Electronics, Clothing, Toiletries, Documents, Misc).
* **List Management:** A stateful checklist allowing users to manually add, edit, or delete items missed by the AI (due to occlusion/layering).
* **Pack/Unpack Modes:** Two distinct UI states. "Packing" (initial log) and "Repacking" (checking off items for the return journey).
* **Trip Management:** Ability to save lists under specific trip names (e.g., "GSoC Summit 2026").

## 3. Technology Stack

* **Frontend:** Next.js (React) configured as a Progressive Web App (PWA) for native-like mobile camera access and offline-capable checklist rendering.
* **Backend:** Go. Chosen for high-concurrency handling during media uploads and efficient proxying to the Gemini API.
* **Database:** MongoDB. Ideal for handling the unstructured, highly variable lengths of user packing lists and JSON responses from the AI.
* **AI / Vision:** Gemini 1.5 Flash via Google AI Studio API.
* **Storage:** AWS S3 (or equivalent) for temporary media storage before AI processing.
* **Infrastructure:** Docker & Docker Compose for local development and deployment parity.

## 4. System Architecture & Data Flow

1. **Client:** Next.js frontend captures media via the HTML5 `capture="environment"` attribute. Media is compressed client-side to reduce payload.
2. **API Gateway:** Next.js sends a `multipart/form-data` POST request to the Go backend.
3. **Storage & AI Proxy:** The Go backend temporarily writes the file to S3, retrieves the signed URL (or uploads directly to the Gemini File API), and triggers the Gemini 1.5 Flash prompt.
4. **Processing:** Gemini returns a strictly structured JSON array of objects.
5. **Persistence:** The Go backend parses the JSON, structures it into the MongoDB schema, saves the document, and returns the list ID to the frontend.
6. **UI Update:** The frontend hydrates the checklist UI with the database response.

## 5. Database Schema (MongoDB)

The database will utilize a single primary collection for trips to keep queries fast and simple.

**Collection: `trips**`

```json
{
  "_id": "ObjectId",
  "user_id": "String (Auth identifier)",
  "trip_name": "String",
  "created_at": "ISODate",
  "status": "String (Enum: 'packing', 'active_trip', 'repacking', 'completed')",
  "items": [
    {
      "item_id": "UUID",
      "name": "String",
      "category": "String",
      "quantity": "Number",
      "is_packed_for_return": "Boolean (Default: false)",
      "added_by": "String (Enum: 'ai', 'manual')"
    }
  ]
}

```

## 6. API Endpoints (Go Backend)

* `POST /api/v1/trips`
* **Payload:** `multipart/form-data` (media file, `trip_name`).
* **Action:** Handles upload, calls Gemini, creates MongoDB document.
* **Returns:** `201 Created` with the full Trip JSON object.


* `GET /api/v1/trips/:id`
* **Returns:** `200 OK` with the Trip JSON object.


* `PUT /api/v1/trips/:id/items`
* **Payload:** JSON array of updated items.
* **Action:** Updates the `items` array in MongoDB.
* **Returns:** `200 OK`.



## 7. AI Integration & Prompt Engineering

The system requires strict JSON output to allow the Go backend to `json.Unmarshal` the response efficiently.

**Model:** `gemini-1.5-flash`
**System Instruction / Prompt:**

> "You are an automated luggage analysis system. Analyze the provided image/video of a packed suitcase. Identify every distinct item visible. Group them into logical categories. You must respond ONLY with a valid JSON object matching the following schema, with no markdown formatting, no backticks, and no conversational text:
> {
> "items": [
> {"name": "MacBook Air", "category": "Electronics", "quantity": 1},
> {"name": "Blue T-Shirt", "category": "Clothing", "quantity": 3}
> ]
> }"

## 8. Containerization & Orchestration (Docker)

The entire stack will be containerized to ensure consistency across local development and production environments. A `docker-compose.yml` file will orchestrate the multi-container setup.

### Services Defined in Compose

* **`frontend` (Next.js):**
* Built using a multi-stage Dockerfile to optimize image size (builder stage vs. runner stage).
* Exposed on port `3000`.
* Configured with hot-reloading volume mounts for local development.


* **`backend` (Go):**
* Built via a multi-stage Dockerfile (using `golang:alpine` for the build step to compile the binary, and a scratch or minimal alpine image for execution).
* Ensure cross-compilation flags (`CGO_ENABLED=0 GOOS=linux`) are set in the Dockerfile, particularly if developing locally on Apple Silicon (ARM architecture) to prevent execution errors in the container.
* Exposed on port `8080`.


* **`database` (MongoDB):**
* Uses the official `mongo:latest` image.
* Exposed on port `27017`.
* Configured with a named Docker volume (e.g., `mongodb_data`) to persist the checklist data across container restarts.


### Networking

All three services will communicate over a custom bridge network defined in the compose file. The Go backend will connect to MongoDB using the internal Docker DNS (e.g., `mongodb://database:27017`), keeping the database inaccessible to the outside world.
