package trips

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type MongoRepository struct {
	collection *mongo.Collection
}

func NewMongoRepository(collection *mongo.Collection) *MongoRepository {
	return &MongoRepository{collection: collection}
}

func (r *MongoRepository) Create(ctx context.Context, trip *Trip) error {
	result, err := r.collection.InsertOne(ctx, trip)
	if err != nil {
		return fmt.Errorf("insert trip: %w", err)
	}

	if objectID, ok := result.InsertedID.(bson.ObjectID); ok {
		trip.ID = objectID
	}

	return nil
}

func (r *MongoRepository) GetByID(ctx context.Context, id string) (*Trip, error) {
	objectID, err := parseObjectID(id)
	if err != nil {
		return nil, err
	}

	var trip Trip
	if err := r.collection.FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&trip); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("find trip: %w", err)
	}

	return &trip, nil
}

func (r *MongoRepository) UpdateItems(ctx context.Context, id string, items []TripItem, status Status) (*Trip, error) {
	objectID, err := parseObjectID(id)
	if err != nil {
		return nil, err
	}

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "items", Value: items},
			{Key: "status", Value: status},
			{Key: "updated_at", Value: time.Now().UTC()},
		}},
	}

	result, err := r.collection.UpdateByID(ctx, objectID, update)
	if err != nil {
		return nil, fmt.Errorf("update trip items: %w", err)
	}
	if result.MatchedCount == 0 {
		return nil, ErrNotFound
	}

	return r.GetByID(ctx, id)
}

func parseObjectID(id string) (bson.ObjectID, error) {
	objectID, err := bson.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return bson.NilObjectID, newValidationErrorf("trip id must be a valid hex ObjectID")
	}

	return objectID, nil
}
