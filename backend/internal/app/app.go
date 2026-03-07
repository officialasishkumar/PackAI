package app

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/ai"
	"github.com/officialasishkumar/PackAI/backend/internal/config"
	"github.com/officialasishkumar/PackAI/backend/internal/httpapi"
	"github.com/officialasishkumar/PackAI/backend/internal/storage"
	"github.com/officialasishkumar/PackAI/backend/internal/trips"

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
	indexCtx, cancelIndexes := context.WithTimeout(ctx, 10*time.Second)
	defer cancelIndexes()

	if err := repository.EnsureIndexes(indexCtx); err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("ensure mongo indexes: %w", err)
	}

	var archiver storage.Archiver
	if cfg.RetainUploadedMedia() {
		archiver, err = storage.NewArchiver(ctx, cfg)
		if err != nil {
			_ = mongoClient.Disconnect(context.Background())
			return nil, fmt.Errorf("build archiver: %w", err)
		}
	}

	extractor, err := ai.NewGeminiExtractor(ctx, cfg)
	if err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("build extractor: %w", err)
	}

	service := trips.NewService(repository, archiver, extractor, cfg.RetainUploadedMedia())
	handler := httpapi.NewTripHandler(cfg, service)

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
