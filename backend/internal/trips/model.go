package trips

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Status string
type Category string
type AddedBy string

const (
	StatusPacking   Status = "packing"
	StatusActive    Status = "active_trip"
	StatusRepacking Status = "repacking"
	StatusCompleted Status = "completed"
)

const (
	MaxTripNameLength = 80
	MaxTripItems      = 500
	MaxItemNameLength = 120
)

const (
	CategoryElectronics Category = "Electronics"
	CategoryClothing    Category = "Clothing"
	CategoryToiletries  Category = "Toiletries"
	CategoryDocuments   Category = "Documents"
	CategoryMisc        Category = "Misc"
)

const (
	AddedByAI     AddedBy = "ai"
	AddedByManual AddedBy = "manual"
)

type Trip struct {
	ID        bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID    string        `json:"user_id" bson:"user_id"`
	TripName  string        `json:"trip_name" bson:"trip_name"`
	CreatedAt time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time     `json:"updated_at" bson:"updated_at"`
	Status    Status        `json:"status" bson:"status"`
	Items     []TripItem    `json:"items" bson:"items"`
	Location  *TripLocation `json:"location,omitempty" bson:"location,omitempty"`
	Media     *StoredMedia  `json:"media,omitempty" bson:"media,omitempty"`
}

type TripSummary struct {
	ID           bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	TripName     string        `json:"trip_name" bson:"trip_name"`
	CreatedAt    time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at" bson:"updated_at"`
	Status       Status        `json:"status" bson:"status"`
	ItemCount    int           `json:"item_count"`
	TotalUnits   int           `json:"total_units"`
	PreviewItems []TripItem    `json:"preview_items,omitempty"`
	Location     *TripLocation `json:"location,omitempty" bson:"location,omitempty"`
}

type TripItem struct {
	ItemID            string   `json:"item_id" bson:"item_id"`
	Name              string   `json:"name" bson:"name"`
	Category          Category `json:"category" bson:"category"`
	Quantity          int      `json:"quantity" bson:"quantity"`
	IsPackedForReturn bool     `json:"is_packed_for_return" bson:"is_packed_for_return"`
	AddedBy           AddedBy  `json:"added_by" bson:"added_by"`
}

type TripLocation struct {
	Latitude       float64   `json:"latitude" bson:"latitude"`
	Longitude      float64   `json:"longitude" bson:"longitude"`
	AccuracyMeters float64   `json:"accuracy_meters,omitempty" bson:"accuracy_meters,omitempty"`
	CapturedAt     time.Time `json:"captured_at,omitempty" bson:"captured_at,omitempty"`
}

type StoredMedia struct {
	StorageDriver string    `json:"storage_driver" bson:"storage_driver"`
	Location      string    `json:"-" bson:"location"`
	URL           string    `json:"-" bson:"url,omitempty"`
	MIMEType      string    `json:"mime_type" bson:"mime_type"`
	SizeBytes     int64     `json:"size_bytes" bson:"size_bytes"`
	UploadedAt    time.Time `json:"uploaded_at" bson:"uploaded_at"`
}

func CategoryValues() []string {
	return []string{
		string(CategoryElectronics),
		string(CategoryClothing),
		string(CategoryToiletries),
		string(CategoryDocuments),
		string(CategoryMisc),
	}
}

func NormalizeCategory(value string) Category {
	normalized := strings.TrimSpace(strings.ToLower(value))

	switch normalized {
	case "electronics", "tech", "technology":
		return CategoryElectronics
	case "clothing", "apparel", "wardrobe":
		return CategoryClothing
	case "toiletries", "toiletry", "bathroom", "grooming":
		return CategoryToiletries
	case "documents", "document", "travel documents", "paperwork":
		return CategoryDocuments
	case "misc", "miscellaneous", "other":
		return CategoryMisc
	}

	switch {
	case containsAny(normalized, "shirt", "pant", "sock", "jacket", "dress", "shoe", "clothing"):
		return CategoryClothing
	case containsAny(normalized, "laptop", "phone", "charger", "camera", "tablet", "electronics", "headphones"):
		return CategoryElectronics
	case containsAny(normalized, "passport", "ticket", "document", "wallet", "id", "boarding pass"):
		return CategoryDocuments
	case containsAny(normalized, "tooth", "soap", "toiletry", "shampoo", "deodorant", "razor", "brush"):
		return CategoryToiletries
	default:
		return CategoryMisc
	}
}

func NormalizeStatus(value string) Status {
	switch Status(strings.TrimSpace(value)) {
	case StatusPacking:
		return StatusPacking
	case StatusActive:
		return StatusActive
	case StatusRepacking:
		return StatusRepacking
	case StatusCompleted:
		return StatusCompleted
	default:
		return ""
	}
}

func PrepareItems(items []TripItem) ([]TripItem, error) {
	if len(items) > MaxTripItems {
		return nil, newValidationErrorf("a trip can contain at most %d items", MaxTripItems)
	}

	prepared := make([]TripItem, 0, len(items))

	for index, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			return nil, newValidationErrorf("item %d must have a name", index+1)
		}
		if len([]rune(name)) > MaxItemNameLength {
			return nil, newValidationErrorf("item %d name must be %d characters or fewer", index+1, MaxItemNameLength)
		}

		if strings.TrimSpace(item.ItemID) == "" {
			item.ItemID = uuid.NewString()
		}

		item.Name = name
		item.Category = NormalizeCategory(string(item.Category))
		if item.Quantity <= 0 {
			item.Quantity = 1
		}

		switch item.AddedBy {
		case AddedByAI:
		default:
			item.AddedBy = AddedByManual
		}

		prepared = append(prepared, item)
	}

	return prepared, nil
}

func DeriveStatus(requested Status, items []TripItem) Status {
	status := NormalizeStatus(string(requested))
	if status == "" {
		status = StatusPacking
	}

	anyChecked := false
	allChecked := len(items) > 0
	for _, item := range items {
		if item.IsPackedForReturn {
			anyChecked = true
		} else {
			allChecked = false
		}
	}

	if allChecked {
		return StatusCompleted
	}
	if anyChecked && status == StatusPacking {
		return StatusRepacking
	}

	return status
}

func containsAny(value string, parts ...string) bool {
	for _, part := range parts {
		if strings.Contains(value, part) {
			return true
		}
	}

	return false
}

func SummarizeTrip(trip Trip) TripSummary {
	itemCount, totalUnits := CountItems(trip.Items)

	return TripSummary{
		ID:           trip.ID,
		TripName:     trip.TripName,
		CreatedAt:    trip.CreatedAt,
		UpdatedAt:    trip.UpdatedAt,
		Status:       trip.Status,
		ItemCount:    itemCount,
		TotalUnits:   totalUnits,
		PreviewItems: previewItems(trip.Items, 4),
		Location:     trip.Location,
	}
}

func CountItems(items []TripItem) (itemCount int, totalUnits int) {
	itemCount = len(items)
	for _, item := range items {
		totalUnits += item.Quantity
	}

	return itemCount, totalUnits
}

func previewItems(items []TripItem, limit int) []TripItem {
	if limit <= 0 || len(items) == 0 {
		return nil
	}
	if len(items) < limit {
		limit = len(items)
	}

	preview := make([]TripItem, 0, limit)
	for _, item := range items[:limit] {
		preview = append(preview, item)
	}

	return preview
}
