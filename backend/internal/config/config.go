package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	APIPort              string
	AllowedOrigins       []string
	MongoURI             string
	MongoDatabase        string
	MediaRetentionMode   string
	MediaStorageDriver   string
	LocalMediaDir        string
	GoogleAPIKey         string
	GeminiModel          string
	CreateTripTimeout    time.Duration
	ReadTripTimeout      time.Duration
	UpdateTripTimeout    time.Duration
	CreateRateLimit      int
	ReadRateLimit        int
	UpdateRateLimit      int
	InternalAPIAuthToken string
	AWSRegion            string
	S3Bucket             string
	S3Prefix             string
	S3Endpoint           string
	S3ForcePathStyle     bool
	S3StorageClass       string
}

func Load() (Config, error) {
	createTripTimeout, err := parseDurationEnv("CREATE_TRIP_TIMEOUT", 2*time.Minute)
	if err != nil {
		return Config{}, err
	}

	readTripTimeout, err := parseDurationEnv("READ_TRIP_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}

	updateTripTimeout, err := parseDurationEnv("UPDATE_TRIP_TIMEOUT", 15*time.Second)
	if err != nil {
		return Config{}, err
	}

	createRateLimit, err := parsePositiveIntEnv("CREATE_RATE_LIMIT_PER_MINUTE", 12)
	if err != nil {
		return Config{}, err
	}

	readRateLimit, err := parsePositiveIntEnv("READ_RATE_LIMIT_PER_MINUTE", 180)
	if err != nil {
		return Config{}, err
	}

	updateRateLimit, err := parsePositiveIntEnv("UPDATE_RATE_LIMIT_PER_MINUTE", 60)
	if err != nil {
		return Config{}, err
	}

	mediaRetentionMode := valueOrDefault("MEDIA_RETENTION_MODE", "discard")
	switch strings.ToLower(strings.TrimSpace(mediaRetentionMode)) {
	case "discard", "archive":
	default:
		return Config{}, fmt.Errorf("MEDIA_RETENTION_MODE must be one of discard or archive")
	}

	forcePathStyle, err := parseBoolEnv("S3_FORCE_PATH_STYLE", false)
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		APIPort:              valueOrDefault("API_PORT", "8080"),
		AllowedOrigins:       splitCSV(valueOrDefault("ALLOWED_ORIGINS", "http://localhost:3000")),
		MongoURI:             valueOrDefault("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDatabase:        valueOrDefault("MONGODB_DATABASE", "packai"),
		MediaRetentionMode:   mediaRetentionMode,
		MediaStorageDriver:   valueOrDefault("MEDIA_STORAGE_DRIVER", "local"),
		LocalMediaDir:        valueOrDefault("LOCAL_MEDIA_DIR", "./tmp/media"),
		GoogleAPIKey:         strings.TrimSpace(os.Getenv("GOOGLE_API_KEY")),
		GeminiModel:          valueOrDefault("GEMINI_MODEL", "gemini-2.5-flash"),
		CreateTripTimeout:    createTripTimeout,
		ReadTripTimeout:      readTripTimeout,
		UpdateTripTimeout:    updateTripTimeout,
		CreateRateLimit:      createRateLimit,
		ReadRateLimit:        readRateLimit,
		UpdateRateLimit:      updateRateLimit,
		InternalAPIAuthToken: strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN")),
		AWSRegion:            strings.TrimSpace(os.Getenv("AWS_REGION")),
		S3Bucket:             strings.TrimSpace(os.Getenv("S3_BUCKET")),
		S3Prefix:             valueOrDefault("S3_PREFIX", "packai/uploads"),
		S3Endpoint:           strings.TrimSpace(os.Getenv("S3_ENDPOINT")),
		S3ForcePathStyle:     forcePathStyle,
		S3StorageClass:       strings.TrimSpace(os.Getenv("S3_STORAGE_CLASS")),
	}

	if cfg.APIPort == "" {
		return Config{}, errors.New("API_PORT must not be empty")
	}

	return cfg, nil
}

func (c Config) ListenAddr() string {
	return ":" + c.APIPort
}

func (c Config) RetainUploadedMedia() bool {
	return strings.EqualFold(strings.TrimSpace(c.MediaRetentionMode), "archive")
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

func parseDurationEnv(key string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}

	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return parsed, nil
}

func parsePositiveIntEnv(key string, fallback int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero", key)
	}

	return value, nil
}

func parseBoolEnv(key string, fallback bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("parse %s: %w", key, err)
	}

	return value, nil
}
