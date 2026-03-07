package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type LocalArchiver struct {
	rootDir string
}

func NewLocalArchiver(rootDir string) *LocalArchiver {
	return &LocalArchiver{rootDir: rootDir}
}

func (a *LocalArchiver) Archive(_ context.Context, input ArchiveInput) (*ArchivedMedia, error) {
	if err := os.MkdirAll(a.rootDir, 0o755); err != nil {
		return nil, fmt.Errorf("create local media directory: %w", err)
	}

	source, err := os.Open(input.LocalPath)
	if err != nil {
		return nil, fmt.Errorf("open source media: %w", err)
	}
	defer source.Close()

	fileName := uuid.NewString() + input.Extension
	destinationPath := filepath.Join(a.rootDir, time.Now().UTC().Format("2006/01/02"), fileName)
	if err := os.MkdirAll(filepath.Dir(destinationPath), 0o755); err != nil {
		return nil, fmt.Errorf("create local media path: %w", err)
	}

	destination, err := os.Create(destinationPath)
	if err != nil {
		return nil, fmt.Errorf("create destination media file: %w", err)
	}
	defer destination.Close()

	if _, err := io.Copy(destination, source); err != nil {
		return nil, fmt.Errorf("copy media to local archive: %w", err)
	}

	return &ArchivedMedia{
		StorageDriver: "local",
		Location:      destinationPath,
		MIMEType:      input.MIMEType,
		SizeBytes:     input.SizeBytes,
		UploadedAt:    time.Now().UTC(),
	}, nil
}
