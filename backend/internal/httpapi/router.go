package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/officialasishkumar/PackAI/backend/internal/config"
)

func NewRouter(cfg config.Config, tripHandler *TripHandler) http.Handler {
	mux := http.NewServeMux()
	createLimiter := newFixedWindowLimiter(cfg.CreateRateLimit, time.Minute)
	readLimiter := newFixedWindowLimiter(cfg.ReadRateLimit, time.Minute)
	updateLimiter := newFixedWindowLimiter(cfg.UpdateRateLimit, time.Minute)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})
	mux.Handle("POST /api/v1/trips", createLimiter.Middleware(http.HandlerFunc(tripHandler.CreateTrip)))
	mux.Handle("GET /api/v1/trips/{id}", readLimiter.Middleware(http.HandlerFunc(tripHandler.GetTrip)))
	mux.Handle("PUT /api/v1/trips/{id}/items", updateLimiter.Middleware(http.HandlerFunc(tripHandler.UpdateTripItems)))

	return chain(
		mux,
		withRecovery,
		withRequestID,
		withSecurityHeaders,
		func(next http.Handler) http.Handler {
			return withCORS(cfg.AllowedOrigins, next)
		},
	)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}

func withCORS(allowedOrigins []string, next http.Handler) http.Handler {
	allowAll := false
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		if origin == "*" {
			allowAll = true
			continue
		}
		allowed[origin] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" {
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
		}

		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
