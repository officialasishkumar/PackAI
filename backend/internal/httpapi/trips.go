package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/ai"
	"github.com/officialasishkumar/PackAI/backend/internal/config"
	"github.com/officialasishkumar/PackAI/backend/internal/media"
	"github.com/officialasishkumar/PackAI/backend/internal/trips"
)

const maxMultipartBodyBytes = media.MaxUploadBytes + (1 << 20)
const maxItemsUpdateBodyBytes int64 = 1 << 20

type TripService interface {
	ListTrips(ctx context.Context, userID string, limit int64) ([]trips.TripSummary, error)
	CreateTrip(ctx context.Context, input trips.CreateTripInput) (*trips.Trip, error)
	GetTrip(ctx context.Context, id string, userID string) (*trips.Trip, error)
	UpdateItems(ctx context.Context, id string, userID string, input trips.UpdateItemsInput) (*trips.Trip, error)
}

type TripHandler struct {
	service           TripService
	createTripTimeout time.Duration
	readTripTimeout   time.Duration
	updateTripTimeout time.Duration
}

func NewTripHandler(cfg config.Config, service TripService) *TripHandler {
	return &TripHandler{
		service:           service,
		createTripTimeout: cfg.CreateTripTimeout,
		readTripTimeout:   cfg.ReadTripTimeout,
		updateTripTimeout: cfg.UpdateTripTimeout,
	}
}

func (h *TripHandler) ListTrips(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	limit := int64(30)
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		parsed, err := strconv.ParseInt(rawLimit, 10, 64)
		if err != nil || parsed <= 0 {
			writeError(w, http.StatusBadRequest, "limit must be a positive integer")
			return
		}
		limit = parsed
	}

	ctx, cancel := context.WithTimeout(r.Context(), h.readTripTimeout)
	defer cancel()

	summaries, err := h.service.ListTrips(ctx, userID, limit)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"trips": summaries,
	})
}

func (h *TripHandler) CreateTrip(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxMultipartBodyBytes)
	if err := r.ParseMultipartForm(maxMultipartBodyBytes); err != nil {
		h.writeParseError(w, err, "multipart request is invalid or too large")
		return
	}

	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	mediaFile, header, err := r.FormFile("media")
	if err != nil {
		writeError(w, http.StatusBadRequest, "media file is required")
		return
	}
	defer mediaFile.Close()

	tempPath, err := persistTempUpload(mediaFile, header.Filename)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store uploaded media")
		return
	}
	defer os.Remove(tempPath)

	metadata, err := media.InspectUpload(tempPath, header.Filename, header.Header.Get("Content-Type"), header.Size)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	location, err := decodeTripLocation(
		r.FormValue("location_latitude"),
		r.FormValue("location_longitude"),
		r.FormValue("location_accuracy_meters"),
		r.FormValue("location_captured_at"),
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), h.createTripTimeout)
	defer cancel()

	trip, err := h.service.CreateTrip(ctx, trips.CreateTripInput{
		TripName:  r.FormValue("trip_name"),
		UserID:    userID,
		Media:     metadata,
		MediaPath: tempPath,
		Location:  location,
	})
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, trip)
}

func (h *TripHandler) GetTrip(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), h.readTripTimeout)
	defer cancel()

	trip, err := h.service.GetTrip(ctx, r.PathValue("id"), userID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, trip)
}

func (h *TripHandler) UpdateTripItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	defer r.Body.Close()

	r.Body = http.MaxBytesReader(w, r.Body, maxItemsUpdateBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.writeParseError(w, err, "failed to read request body")
		return
	}

	input, err := decodeUpdateItemsRequest(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), h.updateTripTimeout)
	defer cancel()

	trip, err := h.service.UpdateItems(ctx, r.PathValue("id"), userID, input)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, trip)
}

func (h *TripHandler) writeDomainError(w http.ResponseWriter, err error) {
	var validationErr *trips.ValidationError

	switch {
	case errors.As(err, &validationErr):
		writeError(w, http.StatusBadRequest, validationErr.Error())
	case errors.Is(err, trips.ErrNotFound):
		writeError(w, http.StatusNotFound, "trip not found")
	case errors.Is(err, media.ErrUnsupportedType), errors.Is(err, media.ErrUploadTooLarge):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, context.DeadlineExceeded):
		writeError(w, http.StatusGatewayTimeout, "request timed out")
	case errors.Is(err, ai.ErrUnavailable):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
}

func (h *TripHandler) writeParseError(w http.ResponseWriter, err error, fallback string) {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		writeError(w, http.StatusRequestEntityTooLarge, "request body exceeds the allowed size")
		return
	}

	writeError(w, http.StatusBadRequest, fallback)
}

func decodeUpdateItemsRequest(body []byte) (trips.UpdateItemsInput, error) {
	var wrapped trips.UpdateItemsInput
	if err := json.Unmarshal(body, &wrapped); err == nil && wrapped.Items != nil {
		return wrapped, nil
	}

	var items []trips.TripItem
	if err := json.Unmarshal(body, &items); err != nil {
		return trips.UpdateItemsInput{}, fmt.Errorf("request body must be an items array or an object with items")
	}

	return trips.UpdateItemsInput{Items: items}, nil
}

func persistTempUpload(file multipart.File, originalName string) (string, error) {
	extension := filepath.Ext(originalName)
	tempFile, err := os.CreateTemp("", "packai-*"+extension)
	if err != nil {
		return "", err
	}

	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		return "", err
	}

	return tempFile.Name(), nil
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": strings.TrimSpace(message),
	})
}

func requireUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID := strings.TrimSpace(r.Header.Get("X-User-ID"))
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication is required")
		return "", false
	}

	return userID, true
}

func decodeTripLocation(latitudeRaw, longitudeRaw, accuracyRaw, capturedAtRaw string) (*trips.TripLocation, error) {
	latitudeRaw = strings.TrimSpace(latitudeRaw)
	longitudeRaw = strings.TrimSpace(longitudeRaw)
	if latitudeRaw == "" && longitudeRaw == "" {
		return nil, nil
	}
	if latitudeRaw == "" || longitudeRaw == "" {
		return nil, fmt.Errorf("location must include both latitude and longitude")
	}

	latitude, err := strconv.ParseFloat(latitudeRaw, 64)
	if err != nil {
		return nil, fmt.Errorf("location latitude must be a valid number")
	}
	if latitude < -90 || latitude > 90 {
		return nil, fmt.Errorf("location latitude must be between -90 and 90")
	}
	longitude, err := strconv.ParseFloat(longitudeRaw, 64)
	if err != nil {
		return nil, fmt.Errorf("location longitude must be a valid number")
	}
	if longitude < -180 || longitude > 180 {
		return nil, fmt.Errorf("location longitude must be between -180 and 180")
	}

	accuracy := 0.0
	if strings.TrimSpace(accuracyRaw) != "" {
		accuracy, err = strconv.ParseFloat(strings.TrimSpace(accuracyRaw), 64)
		if err != nil {
			return nil, fmt.Errorf("location accuracy must be a valid number")
		}
		if accuracy < 0 {
			return nil, fmt.Errorf("location accuracy must not be negative")
		}
	}

	var capturedAt time.Time
	if strings.TrimSpace(capturedAtRaw) != "" {
		capturedAt, err = time.Parse(time.RFC3339, strings.TrimSpace(capturedAtRaw))
		if err != nil {
			return nil, fmt.Errorf("location captured_at must be an RFC3339 timestamp")
		}
	}

	return &trips.TripLocation{
		Latitude:       latitude,
		Longitude:      longitude,
		AccuracyMeters: accuracy,
		CapturedAt:     capturedAt,
	}, nil
}
