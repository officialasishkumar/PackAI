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
	GetByID(ctx context.Context, id string) (*Trip, error)
	UpdateItems(ctx context.Context, id string, items []TripItem, status Status) (*Trip, error)
}
