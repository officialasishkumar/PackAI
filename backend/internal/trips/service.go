package trips

import (
	"context"
	"fmt"
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
		userID = "local-demo-user"
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
		Media:     storedMedia,
	}

	if err := s.repository.Create(ctx, trip); err != nil {
		return nil, err
	}

	return trip, nil
}

func (s *Service) GetTrip(ctx context.Context, id string) (*Trip, error) {
	return s.repository.GetByID(ctx, id)
}

func (s *Service) UpdateItems(ctx context.Context, id string, input UpdateItemsInput) (*Trip, error) {
	items, err := PrepareItems(input.Items)
	if err != nil {
		return nil, err
	}

	status := DeriveStatus(input.Status, items)
	return s.repository.UpdateItems(ctx, id, items, status)
}
