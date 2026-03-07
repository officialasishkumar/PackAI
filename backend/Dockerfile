FROM golang:1.26-alpine AS base
WORKDIR /app
RUN apk add --no-cache ca-certificates git wget

FROM base AS development
COPY go.mod go.sum ./
RUN go mod download
COPY . .

FROM base AS builder
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /packai-api ./cmd/api

FROM alpine:3.22 AS runner
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=builder /packai-api /usr/local/bin/packai-api
EXPOSE 8080
CMD ["packai-api"]

