package app

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"packsnap/backend/internal/ai"
	"packsnap/backend/internal/config"
	"packsnap/backend/internal/httpapi"
	"packsnap/backend/internal/storage"
	"packsnap/backend/internal/trips"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

type App struct {
	Handler     http.Handler
	mongoClient *mongo.Client
}

func New(ctx context.Context, cfg config.Config) (*App, error) {
	mongoClient, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return nil, fmt.Errorf("connect mongo: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := mongoClient.Ping(pingCtx, readpref.Primary()); err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("ping mongo: %w", err)
	}

	repository := trips.NewMongoRepository(mongoClient.Database(cfg.MongoDatabase).Collection("trips"))

	archiver, err := storage.NewArchiver(ctx, cfg)
	if err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("build archiver: %w", err)
	}

	extractor, err := ai.NewGeminiExtractor(ctx, cfg)
	if err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("build extractor: %w", err)
	}

	service := trips.NewService(repository, archiver, extractor)
	handler := httpapi.NewTripHandler(service)

	return &App{
		Handler:     httpapi.NewRouter(cfg, handler),
		mongoClient: mongoClient,
	}, nil
}

func (a *App) Close(ctx context.Context) error {
	if a.mongoClient == nil {
		return nil
	}

	return a.mongoClient.Disconnect(ctx)
}
