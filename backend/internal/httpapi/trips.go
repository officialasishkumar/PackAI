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
	"strings"

	"packsnap/backend/internal/ai"
	"packsnap/backend/internal/media"
	"packsnap/backend/internal/trips"
)

const maxMultipartBodyBytes = media.MaxUploadBytes + (1 << 20)

type TripService interface {
	CreateTrip(ctx context.Context, input trips.CreateTripInput) (*trips.Trip, error)
	GetTrip(ctx context.Context, id string) (*trips.Trip, error)
	UpdateItems(ctx context.Context, id string, input trips.UpdateItemsInput) (*trips.Trip, error)
}

type TripHandler struct {
	service TripService
}

func NewTripHandler(service TripService) *TripHandler {
	return &TripHandler{service: service}
}

func (h *TripHandler) CreateTrip(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxMultipartBodyBytes)
	if err := r.ParseMultipartForm(maxMultipartBodyBytes); err != nil {
		writeError(w, http.StatusBadRequest, "multipart request is invalid or too large")
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

	trip, err := h.service.CreateTrip(r.Context(), trips.CreateTripInput{
		TripName:  r.FormValue("trip_name"),
		UserID:    r.FormValue("user_id"),
		Media:     metadata,
		MediaPath: tempPath,
	})
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, trip)
}

func (h *TripHandler) GetTrip(w http.ResponseWriter, r *http.Request) {
	trip, err := h.service.GetTrip(r.Context(), r.PathValue("id"))
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, trip)
}

func (h *TripHandler) UpdateTripItems(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	input, err := decodeUpdateItemsRequest(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	trip, err := h.service.UpdateItems(r.Context(), r.PathValue("id"), input)
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
	case errors.Is(err, ai.ErrUnavailable):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
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
	tempFile, err := os.CreateTemp("", "packsnap-*"+extension)
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
