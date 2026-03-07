package media

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrUnsupportedType = errors.New("unsupported media type")
	ErrUploadTooLarge  = errors.New("upload is too large")
)

const MaxUploadBytes int64 = 64 << 20

type UploadMetadata struct {
	OriginalFilename string `json:"original_filename"`
	MIMEType         string `json:"mime_type"`
	Extension        string `json:"extension"`
	Kind             string `json:"kind"`
	SizeBytes        int64  `json:"size_bytes"`
}

func InspectUpload(path, originalFilename, declaredMIME string, sizeBytes int64) (UploadMetadata, error) {
	originalFilename = sanitizeOriginalFilename(originalFilename)

	fileInfo, err := os.Stat(path)
	if err != nil {
		return UploadMetadata{}, fmt.Errorf("stat upload: %w", err)
	}

	if sizeBytes <= 0 {
		sizeBytes = fileInfo.Size()
	}

	if sizeBytes > MaxUploadBytes {
		return UploadMetadata{}, fmt.Errorf("%w: max upload size is %d MB", ErrUploadTooLarge, MaxUploadBytes>>20)
	}

	file, err := os.Open(path)
	if err != nil {
		return UploadMetadata{}, fmt.Errorf("open upload: %w", err)
	}
	defer file.Close()

	sniffed, err := sniffMIMEType(file)
	if err != nil {
		return UploadMetadata{}, fmt.Errorf("sniff upload: %w", err)
	}

	extension := strings.ToLower(filepath.Ext(originalFilename))
	mimeType, kind, err := resolveType(extension, declaredMIME, sniffed)
	if err != nil {
		return UploadMetadata{}, err
	}

	return UploadMetadata{
		OriginalFilename: originalFilename,
		MIMEType:         mimeType,
		Extension:        extension,
		Kind:             kind,
		SizeBytes:        sizeBytes,
	}, nil
}

func sniffMIMEType(file *os.File) (string, error) {
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	head := make([]byte, 512)
	n, err := file.Read(head)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	return http.DetectContentType(head[:n]), nil
}

func resolveType(extension, declaredMIME, sniffedMIME string) (mimeType string, kind string, err error) {
	switch extension {
	case ".jpg", ".jpeg":
		if matchesMIME([]string{"image/jpeg"}, declaredMIME, sniffedMIME) {
			return "image/jpeg", "image", nil
		}
	case ".png":
		if matchesMIME([]string{"image/png"}, declaredMIME, sniffedMIME) {
			return "image/png", "image", nil
		}
	case ".mp4":
		if matchesMIME([]string{"video/mp4", "application/octet-stream"}, declaredMIME, sniffedMIME) {
			return "video/mp4", "video", nil
		}
	}

	return "", "", fmt.Errorf("%w: only JPEG, PNG, and MP4 uploads are supported", ErrUnsupportedType)
}

func matchesMIME(allowed []string, declaredMIME, sniffedMIME string) bool {
	if containsMIME(allowed, declaredMIME) || containsMIME(allowed, sniffedMIME) {
		return true
	}

	declaredMIME = strings.TrimSpace(strings.ToLower(declaredMIME))
	sniffedMIME = strings.TrimSpace(strings.ToLower(sniffedMIME))

	if containsMIME(allowed, "image/jpeg") && strings.HasPrefix(declaredMIME, "image/") && strings.HasPrefix(sniffedMIME, "image/") {
		return true
	}

	return false
}

func containsMIME(allowed []string, candidate string) bool {
	candidate = strings.TrimSpace(strings.ToLower(candidate))
	for _, mimeType := range allowed {
		if candidate == strings.ToLower(mimeType) {
			return true
		}
	}

	return false
}

func sanitizeOriginalFilename(value string) string {
	value = strings.TrimSpace(filepath.Base(value))
	if value == "." || value == "/" || value == "" {
		return "upload"
	}

	return value
}
