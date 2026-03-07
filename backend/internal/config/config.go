package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	APIPort            string
	AllowedOrigins     []string
	MongoURI           string
	MongoDatabase      string
	MediaStorageDriver string
	LocalMediaDir      string
	GoogleAPIKey       string
	GeminiModel        string
	AWSRegion          string
	S3Bucket           string
	S3Prefix           string
	S3PresignTTL       time.Duration
}

func Load() (Config, error) {
	presignTTL := 15 * time.Minute
	if raw := strings.TrimSpace(os.Getenv("S3_PRESIGN_TTL")); raw != "" {
		parsed, err := time.ParseDuration(raw)
		if err != nil {
			return Config{}, fmt.Errorf("parse S3_PRESIGN_TTL: %w", err)
		}
		presignTTL = parsed
	}

	cfg := Config{
		APIPort:            valueOrDefault("API_PORT", "8080"),
		AllowedOrigins:     splitCSV(valueOrDefault("ALLOWED_ORIGINS", "http://localhost:3000")),
		MongoURI:           valueOrDefault("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDatabase:      valueOrDefault("MONGODB_DATABASE", "packai"),
		MediaStorageDriver: valueOrDefault("MEDIA_STORAGE_DRIVER", "local"),
		LocalMediaDir:      valueOrDefault("LOCAL_MEDIA_DIR", "./tmp/media"),
		GoogleAPIKey:       strings.TrimSpace(os.Getenv("GOOGLE_API_KEY")),
		GeminiModel:        valueOrDefault("GEMINI_MODEL", "gemini-2.5-flash"),
		AWSRegion:          strings.TrimSpace(os.Getenv("AWS_REGION")),
		S3Bucket:           strings.TrimSpace(os.Getenv("S3_BUCKET")),
		S3Prefix:           valueOrDefault("S3_PREFIX", "packai/uploads"),
		S3PresignTTL:       presignTTL,
	}

	if cfg.APIPort == "" {
		return Config{}, errors.New("API_PORT must not be empty")
	}

	return cfg, nil
}

func (c Config) ListenAddr() string {
	return ":" + c.APIPort
}

func valueOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}

	return fallback
}

func splitCSV(value string) []string {
	raw := strings.Split(value, ",")
	parts := make([]string, 0, len(raw))
	for _, item := range raw {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		parts = append(parts, item)
	}

	return parts
}
