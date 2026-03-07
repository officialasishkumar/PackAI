package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"packsnap/backend/internal/config"
)

type ArchiveInput struct {
	LocalPath  string
	FileName   string
	Extension  string
	MIMEType   string
	SizeBytes  int64
	ObjectName string
}

type ArchivedMedia struct {
	StorageDriver string
	Location      string
	URL           string
	MIMEType      string
	SizeBytes     int64
	UploadedAt    time.Time
}

type Archiver interface {
	Archive(ctx context.Context, input ArchiveInput) (*ArchivedMedia, error)
}

func NewArchiver(ctx context.Context, cfg config.Config) (Archiver, error) {
	driver := strings.ToLower(strings.TrimSpace(cfg.MediaStorageDriver))

	switch driver {
	case "", "local":
		return NewLocalArchiver(cfg.LocalMediaDir), nil
	case "s3":
		return NewS3Archiver(ctx, cfg)
	default:
		return nil, fmt.Errorf("unsupported media storage driver %q", cfg.MediaStorageDriver)
	}
}
