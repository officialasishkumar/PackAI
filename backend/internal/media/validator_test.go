package media

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInspectUploadAcceptsJPEG(t *testing.T) {
	t.Parallel()

	path := writeFixture(t, "photo.jpg", []byte{
		0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x43, 0x00,
	})

	metadata, err := InspectUpload(path, "photo.jpg", "image/jpeg", 0)
	if err != nil {
		t.Fatalf("InspectUpload() error = %v", err)
	}

	if metadata.MIMEType != "image/jpeg" {
		t.Fatalf("InspectUpload() MIMEType = %q", metadata.MIMEType)
	}
	if metadata.Kind != "image" {
		t.Fatalf("InspectUpload() Kind = %q", metadata.Kind)
	}
}

func TestInspectUploadRejectsUnsupportedFile(t *testing.T) {
	t.Parallel()

	path := writeFixture(t, "notes.txt", []byte("just text"))

	if _, err := InspectUpload(path, "notes.txt", "text/plain", 0); err == nil {
		t.Fatal("InspectUpload() expected error for unsupported file")
	}
}

func TestInspectUploadRejectsOversizeFile(t *testing.T) {
	t.Parallel()

	path := writeFixture(t, "photo.jpg", []byte{
		0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x43, 0x00,
	})

	if _, err := InspectUpload(path, "photo.jpg", "image/jpeg", MaxUploadBytes+1); err == nil {
		t.Fatal("InspectUpload() expected error for oversized upload")
	}
}

func writeFixture(t *testing.T, name string, payload []byte) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		t.Fatalf("os.WriteFile() error = %v", err)
	}

	return path
}
