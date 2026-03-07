package trips

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MongoRepository struct {
	collection *mongo.Collection
}

func NewMongoRepository(collection *mongo.Collection) *MongoRepository {
	return &MongoRepository{collection: collection}
}

func (r *MongoRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "created_at", Value: -1},
			},
			Options: options.Index().SetName("user_id_created_at"),
		},
		{
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "updated_at", Value: -1},
			},
			Options: options.Index().SetName("status_updated_at"),
		},
	})
	if err != nil {
		return fmt.Errorf("create trip indexes: %w", err)
	}

	return nil
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

func (r *MongoRepository) ListByUser(ctx context.Context, userID string, limit int64) ([]TripSummary, error) {
	filter := bson.D{{Key: "user_id", Value: strings.TrimSpace(userID)}}
	findOptions := options.Find().
		SetLimit(limit).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, fmt.Errorf("list trips: %w", err)
	}
	defer cursor.Close(ctx)

	summaries := make([]TripSummary, 0)
	for cursor.Next(ctx) {
		var trip Trip
		if err := cursor.Decode(&trip); err != nil {
			return nil, fmt.Errorf("decode trip: %w", err)
		}
		summaries = append(summaries, SummarizeTrip(trip))
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("iterate trips: %w", err)
	}

	return summaries, nil
}

func (r *MongoRepository) GetByID(ctx context.Context, id string, userID string) (*Trip, error) {
	objectID, err := parseObjectID(id)
	if err != nil {
		return nil, err
	}

	var trip Trip
	filter := bson.D{
		{Key: "_id", Value: objectID},
		{Key: "user_id", Value: strings.TrimSpace(userID)},
	}
	if err := r.collection.FindOne(ctx, filter).Decode(&trip); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("find trip: %w", err)
	}

	return &trip, nil
}

func (r *MongoRepository) UpdateItems(ctx context.Context, id string, userID string, items []TripItem, status Status) (*Trip, error) {
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

	result, err := r.collection.UpdateOne(ctx, bson.D{
		{Key: "_id", Value: objectID},
		{Key: "user_id", Value: strings.TrimSpace(userID)},
	}, update)
	if err != nil {
		return nil, fmt.Errorf("update trip items: %w", err)
	}
	if result.MatchedCount == 0 {
		return nil, ErrNotFound
	}

	return r.GetByID(ctx, id, userID)
}

func parseObjectID(id string) (bson.ObjectID, error) {
	objectID, err := bson.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return bson.NilObjectID, newValidationErrorf("trip id must be a valid hex ObjectID")
	}

	return objectID, nil
}
