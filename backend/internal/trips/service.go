package trips

import (
	"context"
	"fmt"
	"math"
	"path/filepath"
	"strings"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/media"
	"github.com/officialasishkumar/PackAI/backend/internal/storage"
)

type Extractor interface {
	ExtractItems(ctx context.Context, mediaPath string, metadata media.UploadMetadata) ([]TripItem, error)
}

type CreateTripInput struct {
	TripName  string
	UserID    string
	Media     media.UploadMetadata
	MediaPath string
	Location  *TripLocation
}

type UpdateItemsInput struct {
	Items  []TripItem `json:"items"`
	Status Status     `json:"status"`
}

type Service struct {
	repository  Repository
	archiver    storage.Archiver
	extractor   Extractor
	retainMedia bool
}

func NewService(repository Repository, archiver storage.Archiver, extractor Extractor, retainMedia bool) *Service {
	return &Service{
		repository:  repository,
		archiver:    archiver,
		extractor:   extractor,
		retainMedia: retainMedia,
	}
}

func (s *Service) CreateTrip(ctx context.Context, input CreateTripInput) (*Trip, error) {
	tripName := strings.TrimSpace(input.TripName)
	if tripName == "" {
		return nil, newValidationErrorf("trip_name is required")
	}
	if len([]rune(tripName)) > MaxTripNameLength {
		return nil, newValidationErrorf("trip_name must be %d characters or fewer", MaxTripNameLength)
	}

	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return nil, newValidationErrorf("user_id is required")
	}
	if len([]rune(userID)) > 128 {
		return nil, newValidationErrorf("user_id must be 128 characters or fewer")
	}

	items, err := s.extractor.ExtractItems(ctx, input.MediaPath, input.Media)
	if err != nil {
		return nil, err
	}

	preparedItems, err := PrepareItems(items)
	if err != nil {
		return nil, err
	}

	var storedMedia *StoredMedia
	if s.retainMedia {
		if s.archiver == nil {
			return nil, fmt.Errorf("media retention is enabled but no archiver is configured")
		}

		archivedMedia, err := s.archiver.Archive(ctx, storage.ArchiveInput{
			LocalPath:  input.MediaPath,
			FileName:   input.Media.OriginalFilename,
			Extension:  input.Media.Extension,
			MIMEType:   input.Media.MIMEType,
			SizeBytes:  input.Media.SizeBytes,
			ObjectName: strings.TrimSuffix(filepath.Base(input.Media.OriginalFilename), filepath.Ext(input.Media.OriginalFilename)),
		})
		if err != nil {
			return nil, fmt.Errorf("archive upload: %w", err)
		}

		storedMedia = &StoredMedia{
			StorageDriver: archivedMedia.StorageDriver,
			Location:      archivedMedia.Location,
			URL:           archivedMedia.URL,
			MIMEType:      archivedMedia.MIMEType,
			SizeBytes:     archivedMedia.SizeBytes,
			UploadedAt:    archivedMedia.UploadedAt,
		}
	}

	now := time.Now().UTC()
	trip := &Trip{
		UserID:    userID,
		TripName:  tripName,
		CreatedAt: now,
		UpdatedAt: now,
		Status:    StatusPacking,
		Items:     preparedItems,
		Location:  sanitizeLocation(input.Location, now),
		Media:     storedMedia,
	}

	if err := s.repository.Create(ctx, trip); err != nil {
		return nil, err
	}

	return trip, nil
}

func (s *Service) ListTrips(ctx context.Context, userID string, limit int64) ([]TripSummary, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, newValidationErrorf("user_id is required")
	}

	if limit <= 0 {
		limit = 30
	}
	if limit > 90 {
		limit = 90
	}

	return s.repository.ListByUser(ctx, userID, limit)
}

func (s *Service) GetTrip(ctx context.Context, id string, userID string) (*Trip, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, newValidationErrorf("user_id is required")
	}

	return s.repository.GetByID(ctx, id, userID)
}

func (s *Service) UpdateItems(ctx context.Context, id string, userID string, input UpdateItemsInput) (*Trip, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, newValidationErrorf("user_id is required")
	}

	items, err := PrepareItems(input.Items)
	if err != nil {
		return nil, err
	}

	status := DeriveStatus(input.Status, items)
	return s.repository.UpdateItems(ctx, id, userID, items, status)
}

func sanitizeLocation(location *TripLocation, fallbackTime time.Time) *TripLocation {
	if location == nil {
		return nil
	}

	if location.Latitude < -90 || location.Latitude > 90 {
		return nil
	}
	if location.Longitude < -180 || location.Longitude > 180 {
		return nil
	}

	capturedAt := location.CapturedAt.UTC()
	if capturedAt.IsZero() {
		capturedAt = fallbackTime.UTC()
	}

	accuracy := location.AccuracyMeters
	if accuracy < 0 {
		accuracy = 0
	}

	return &TripLocation{
		Latitude:       roundCoordinate(location.Latitude, 3),
		Longitude:      roundCoordinate(location.Longitude, 3),
		AccuracyMeters: roundCoordinate(accuracy, 1),
		CapturedAt:     capturedAt,
	}
}

func roundCoordinate(value float64, precision int) float64 {
	scale := math.Pow10(precision)
	return math.Round(value*scale) / scale
}
