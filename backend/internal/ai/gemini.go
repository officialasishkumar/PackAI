package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"packsnap/backend/internal/config"
	"packsnap/backend/internal/media"
	"packsnap/backend/internal/trips"

	"google.golang.org/genai"
)

var ErrUnavailable = errors.New("gemini integration is unavailable")

const (
	defaultTemperature = 0.1
	fileReadyTimeout   = 90 * time.Second
)

type disabledExtractor struct {
	reason string
}

func (d disabledExtractor) ExtractItems(_ context.Context, _ string, _ media.UploadMetadata) ([]trips.TripItem, error) {
	return nil, fmt.Errorf("%w: %s", ErrUnavailable, d.reason)
}

type GeminiExtractor struct {
	client *genai.Client
	model  string
}

type extractionResponse struct {
	Items []extractionItem `json:"items"`
}

type extractionItem struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	Quantity int    `json:"quantity"`
}

func NewGeminiExtractor(ctx context.Context, cfg config.Config) (trips.Extractor, error) {
	if strings.TrimSpace(cfg.GoogleAPIKey) == "" {
		return disabledExtractor{reason: "GOOGLE_API_KEY is not configured"}, nil
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  cfg.GoogleAPIKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("create genai client: %w", err)
	}

	return &GeminiExtractor{
		client: client,
		model:  cfg.GeminiModel,
	}, nil
}

func (g *GeminiExtractor) ExtractItems(ctx context.Context, mediaPath string, metadata media.UploadMetadata) ([]trips.TripItem, error) {
	file, err := g.client.Files.UploadFromPath(ctx, mediaPath, &genai.UploadFileConfig{
		MIMEType:    metadata.MIMEType,
		DisplayName: metadata.OriginalFilename,
	})
	if err != nil {
		return nil, fmt.Errorf("upload file to gemini: %w", err)
	}

	defer func() {
		_, _ = g.client.Files.Delete(context.Background(), file.Name, nil)
	}()

	readyFile, err := g.waitUntilReady(ctx, file)
	if err != nil {
		return nil, err
	}

	contents := []*genai.Content{
		genai.NewContentFromParts([]*genai.Part{
			genai.NewPartFromText(buildPrompt(metadata.Kind)),
			genai.NewPartFromFile(*readyFile),
		}, genai.RoleUser),
	}

	temperature := float32(defaultTemperature)
	response, err := g.client.Models.GenerateContent(ctx, g.model, contents, &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Role: genai.RoleUser,
			Parts: []*genai.Part{
				genai.NewPartFromText(systemInstruction),
			},
		},
		Temperature:      &temperature,
		ResponseMIMEType: "application/json",
		ResponseSchema:   extractionSchema(),
	})
	if err != nil {
		return nil, fmt.Errorf("generate content: %w", err)
	}

	payload := strings.TrimSpace(response.Text())
	if payload == "" {
		return nil, errors.New("gemini returned an empty response")
	}

	var parsed extractionResponse
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		return nil, fmt.Errorf("decode gemini response: %w", err)
	}

	items := mergeItems(parsed.Items)
	if len(items) == 0 {
		return nil, errors.New("gemini returned no recognizable items")
	}

	return items, nil
}

func (g *GeminiExtractor) waitUntilReady(ctx context.Context, file *genai.File) (*genai.File, error) {
	deadline := time.Now().Add(fileReadyTimeout)
	current := file

	for {
		switch current.State {
		case "", genai.FileStateActive:
			return current, nil
		case genai.FileStateFailed:
			return nil, fmt.Errorf("gemini file processing failed for %s", current.Name)
		}

		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timed out waiting for gemini file %s to become active", current.Name)
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}

		nextFile, err := g.client.Files.Get(ctx, current.Name, nil)
		if err != nil {
			return nil, fmt.Errorf("poll gemini file %s: %w", current.Name, err)
		}
		current = nextFile
	}
}

func mergeItems(items []extractionItem) []trips.TripItem {
	merged := make(map[string]trips.TripItem, len(items))
	order := make([]string, 0, len(items))

	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}

		category := trips.NormalizeCategory(item.Category)
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}

		key := strings.ToLower(name) + "|" + string(category)
		existing, ok := merged[key]
		if !ok {
			order = append(order, key)
			merged[key] = trips.TripItem{
				ItemID:            "",
				Name:              name,
				Category:          category,
				Quantity:          quantity,
				IsPackedForReturn: false,
				AddedBy:           trips.AddedByAI,
			}
			continue
		}

		existing.Quantity += quantity
		merged[key] = existing
	}

	result := make([]trips.TripItem, 0, len(order))
	for _, key := range order {
		result = append(result, merged[key])
	}

	return result
}

func buildPrompt(kind string) string {
	return fmt.Sprintf(
		"Analyze the provided %s of packed luggage. Identify every distinct item that is clearly visible and estimate a reasonable quantity when multiple matching items appear. Use only these categories: %s.",
		kind,
		strings.Join(trips.CategoryValues(), ", "),
	)
}

func extractionSchema() *genai.Schema {
	minItems := int64(0)
	minQuantity := float64(1)

	return &genai.Schema{
		Type:             genai.TypeObject,
		Required:         []string{"items"},
		PropertyOrdering: []string{"items"},
		Properties: map[string]*genai.Schema{
			"items": {
				Type:     genai.TypeArray,
				MinItems: &minItems,
				Items: &genai.Schema{
					Type:             genai.TypeObject,
					Required:         []string{"name", "category", "quantity"},
					PropertyOrdering: []string{"name", "category", "quantity"},
					Properties: map[string]*genai.Schema{
						"name": {
							Type: genai.TypeString,
						},
						"category": {
							Type:   genai.TypeString,
							Format: "enum",
							Enum:   trips.CategoryValues(),
						},
						"quantity": {
							Type:    genai.TypeInteger,
							Minimum: &minQuantity,
						},
					},
				},
			},
		},
	}
}

const systemInstruction = "You are an automated luggage analysis system. Respond only with valid JSON matching the provided schema. Identify only visible items. Prefer concise item names and the closest allowed category."
