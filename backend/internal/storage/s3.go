package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type S3Archiver struct {
	client     *s3.Client
	presigner  *s3.PresignClient
	bucket     string
	prefix     string
	presignTTL time.Duration
}

func NewS3Archiver(ctx context.Context, cfg config.Config) (*S3Archiver, error) {
	if strings.TrimSpace(cfg.AWSRegion) == "" {
		return nil, fmt.Errorf("AWS_REGION is required when MEDIA_STORAGE_DRIVER=s3")
	}
	if strings.TrimSpace(cfg.S3Bucket) == "" {
		return nil, fmt.Errorf("S3_BUCKET is required when MEDIA_STORAGE_DRIVER=s3")
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg)

	return &S3Archiver{
		client:     client,
		presigner:  s3.NewPresignClient(client),
		bucket:     cfg.S3Bucket,
		prefix:     strings.Trim(cfg.S3Prefix, "/"),
		presignTTL: cfg.S3PresignTTL,
	}, nil
}

func (a *S3Archiver) Archive(ctx context.Context, input ArchiveInput) (*ArchivedMedia, error) {
	file, err := os.Open(input.LocalPath)
	if err != nil {
		return nil, fmt.Errorf("open source media: %w", err)
	}
	defer file.Close()

	keyParts := []string{}
	if a.prefix != "" {
		keyParts = append(keyParts, a.prefix)
	}
	keyParts = append(keyParts, time.Now().UTC().Format("2006/01/02"), uuid.NewString()+filepath.Ext(input.FileName))
	key := strings.Join(keyParts, "/")

	if _, err := a.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(a.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(input.MIMEType),
	}); err != nil {
		return nil, fmt.Errorf("upload to s3: %w", err)
	}

	presigned, err := a.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(a.bucket),
		Key:    aws.String(key),
	}, func(options *s3.PresignOptions) {
		options.Expires = a.presignTTL
	})
	if err != nil {
		return nil, fmt.Errorf("presign s3 object: %w", err)
	}

	return &ArchivedMedia{
		StorageDriver: "s3",
		Location:      fmt.Sprintf("s3://%s/%s", a.bucket, key),
		URL:           presigned.URL,
		MIMEType:      input.MIMEType,
		SizeBytes:     input.SizeBytes,
		UploadedAt:    time.Now().UTC(),
	}, nil
}
