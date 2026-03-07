package trips

import (
	"context"
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("trip not found")

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func newValidationErrorf(format string, args ...any) *ValidationError {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}

type Repository interface {
	Create(ctx context.Context, trip *Trip) error
	ListByUser(ctx context.Context, userID string, limit int64) ([]TripSummary, error)
	GetByID(ctx context.Context, id string, userID string) (*Trip, error)
	UpdateItems(ctx context.Context, id string, userID string, items []TripItem, status Status) (*Trip, error)
}
