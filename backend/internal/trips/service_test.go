package trips

import (
	"context"
	"testing"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/media"
	"github.com/officialasishkumar/PackAI/backend/internal/storage"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type stubRepository struct {
	created *Trip
}

func (s *stubRepository) Create(_ context.Context, trip *Trip) error {
	trip.ID = bson.NewObjectID()
	s.created = trip
	return nil
}

func (s *stubRepository) ListByUser(_ context.Context, _ string, _ int64) ([]TripSummary, error) {
	return nil, nil
}

func (s *stubRepository) GetByID(_ context.Context, _ string, _ string) (*Trip, error) {
	return nil, nil
}

func (s *stubRepository) UpdateItems(_ context.Context, _ string, _ string, _ []TripItem, _ Status) (*Trip, error) {
	return nil, nil
}

type stubArchiver struct {
	called bool
	media  *storage.ArchivedMedia
}

func (s *stubArchiver) Archive(_ context.Context, _ storage.ArchiveInput) (*storage.ArchivedMedia, error) {
	s.called = true
	return s.media, nil
}

type stubExtractor struct {
	items []TripItem
}

func (s stubExtractor) ExtractItems(_ context.Context, _ string, _ media.UploadMetadata) ([]TripItem, error) {
	return s.items, nil
}

func TestCreateTripDiscardsRawMediaByDefault(t *testing.T) {
	t.Parallel()

	repository := &stubRepository{}
	archiver := &stubArchiver{
		media: &storage.ArchivedMedia{
			StorageDriver: "s3",
			Location:      "s3://bucket/object",
			MIMEType:      "image/jpeg",
			SizeBytes:     1024,
			UploadedAt:    time.Now().UTC(),
		},
	}
	service := NewService(repository, archiver, stubExtractor{
		items: []TripItem{{Name: "Passport", Category: CategoryDocuments, Quantity: 1, AddedBy: AddedByAI}},
	}, false)

	trip, err := service.CreateTrip(context.Background(), CreateTripInput{
		TripName: "Goa",
		UserID:   "google-user",
		Media: media.UploadMetadata{
			OriginalFilename: "bag.jpg",
			MIMEType:         "image/jpeg",
			Extension:        ".jpg",
			SizeBytes:        1024,
		},
	})
	if err != nil {
		t.Fatalf("CreateTrip() error = %v", err)
	}

	if archiver.called {
		t.Fatal("CreateTrip() unexpectedly archived media")
	}
	if trip.Media != nil {
		t.Fatal("CreateTrip() expected media metadata to be omitted when retention is disabled")
	}
}

func TestCreateTripArchivesMediaWhenConfigured(t *testing.T) {
	t.Parallel()

	repository := &stubRepository{}
	service := NewService(repository, &stubArchiver{
		media: &storage.ArchivedMedia{
			StorageDriver: "s3",
			Location:      "s3://bucket/object",
			MIMEType:      "image/jpeg",
			SizeBytes:     1024,
			UploadedAt:    time.Now().UTC(),
		},
	}, stubExtractor{
		items: []TripItem{{Name: "Passport", Category: CategoryDocuments, Quantity: 1, AddedBy: AddedByAI}},
	}, true)

	trip, err := service.CreateTrip(context.Background(), CreateTripInput{
		TripName: "Goa",
		UserID:   "google-user",
		Media: media.UploadMetadata{
			OriginalFilename: "bag.jpg",
			MIMEType:         "image/jpeg",
			Extension:        ".jpg",
			SizeBytes:        1024,
		},
	})
	if err != nil {
		t.Fatalf("CreateTrip() error = %v", err)
	}

	if trip.Media == nil {
		t.Fatal("CreateTrip() expected archived media metadata")
	}
	if trip.Media.StorageDriver != "s3" {
		t.Fatalf("CreateTrip() media storage_driver = %q", trip.Media.StorageDriver)
	}
}

func TestCreateTripRoundsSharedLocation(t *testing.T) {
	t.Parallel()

	service := NewService(&stubRepository{}, nil, stubExtractor{
		items: []TripItem{{Name: "Passport", Category: CategoryDocuments, Quantity: 1, AddedBy: AddedByAI}},
	}, false)

	trip, err := service.CreateTrip(context.Background(), CreateTripInput{
		TripName: "Goa",
		UserID:   "google-user",
		Location: &TripLocation{
			Latitude:       12.9715987,
			Longitude:      77.594566,
			AccuracyMeters: 18.987,
		},
	})
	if err != nil {
		t.Fatalf("CreateTrip() error = %v", err)
	}

	if trip.Location == nil {
		t.Fatal("CreateTrip() expected rounded location")
	}
	if trip.Location.Latitude != 12.972 {
		t.Fatalf("CreateTrip() latitude = %v", trip.Location.Latitude)
	}
	if trip.Location.Longitude != 77.595 {
		t.Fatalf("CreateTrip() longitude = %v", trip.Location.Longitude)
	}
}

func TestCreateTripRejectsLongTripNames(t *testing.T) {
	t.Parallel()

	service := NewService(&stubRepository{}, nil, stubExtractor{
		items: []TripItem{{Name: "Passport", Category: CategoryDocuments, Quantity: 1, AddedBy: AddedByAI}},
	}, false)

	tooLong := make([]rune, MaxTripNameLength+1)
	for index := range tooLong {
		tooLong[index] = 'a'
	}

	if _, err := service.CreateTrip(context.Background(), CreateTripInput{
		TripName: string(tooLong),
	}); err == nil {
		t.Fatal("CreateTrip() expected validation error for oversized trip name")
	}
}
