package httpapi

import (
	"log"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type middleware func(http.Handler) http.Handler

func chain(next http.Handler, middlewares ...middleware) http.Handler {
	for index := len(middlewares) - 1; index >= 0; index-- {
		next = middlewares[index](next)
	}

	return next
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if requestID == "" || len(requestID) > 128 {
			requestID = uuid.NewString()
		}

		w.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
	})
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers := w.Header()
		headers.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'")
		headers.Set("Cross-Origin-Resource-Policy", "same-site")
		headers.Set("Referrer-Policy", "no-referrer")
		headers.Set("X-Content-Type-Options", "nosniff")
		headers.Set("X-Frame-Options", "DENY")

		next.ServeHTTP(w, r)
	})
}

func withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("panic while serving %s %s: %v", r.Method, r.URL.Path, recovered)
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()

		next.ServeHTTP(w, r)
	})
}

type fixedWindowLimiter struct {
	limit     int
	window    time.Duration
	mu        sync.Mutex
	entries   map[string]fixedWindowEntry
	lastSweep time.Time
}

type fixedWindowEntry struct {
	windowStart time.Time
	count       int
}

func newFixedWindowLimiter(limit int, window time.Duration) *fixedWindowLimiter {
	return &fixedWindowLimiter{
		limit:     limit,
		window:    window,
		entries:   make(map[string]fixedWindowEntry),
		lastSweep: time.Now(),
	}
}

func (l *fixedWindowLimiter) Middleware(next http.Handler) http.Handler {
	if l == nil || l.limit <= 0 {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		allowed, retryAfter := l.allow(clientIP(r), now)
		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
			writeError(w, http.StatusTooManyRequests, "rate limit exceeded for this endpoint")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (l *fixedWindowLimiter) allow(key string, now time.Time) (bool, time.Duration) {
	if key == "" {
		key = "unknown"
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if now.Sub(l.lastSweep) >= 10*time.Minute {
		l.sweep(now)
	}

	entry := l.entries[key]
	if entry.windowStart.IsZero() || now.Sub(entry.windowStart) >= l.window {
		entry = fixedWindowEntry{
			windowStart: now,
			count:       0,
		}
	}

	if entry.count >= l.limit {
		return false, l.window - now.Sub(entry.windowStart)
	}

	entry.count++
	l.entries[key] = entry

	return true, 0
}

func (l *fixedWindowLimiter) sweep(now time.Time) {
	for key, entry := range l.entries {
		if now.Sub(entry.windowStart) >= 2*l.window {
			delete(l.entries, key)
		}
	}
	l.lastSweep = now
}

func clientIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if host == "" {
		return ""
	}

	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		return parsedHost
	}

	return host
}
