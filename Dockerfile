FROM --platform=$BUILDPLATFORM node:16 AS builder

WORKDIR /web
COPY ./VERSION .
COPY ./web .

# Create parent build directory (themes will create subdirs themselves)
RUN mkdir -p /web/build

# Build default theme (script auto-moves to ../build/default)
WORKDIR /web/default
RUN npm install && \
    DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat /web/VERSION) npm run build

# Build berry theme (script auto-moves to ../build/berry)
WORKDIR /web/berry
RUN npm install && \
    DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat /web/VERSION) npm run build

# Build air theme (script auto-moves to ../build/air)
WORKDIR /web/air
RUN npm install && \
    DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat /web/VERSION) npm run build

# Verify builds exist
WORKDIR /web
RUN echo "=== Build Output Verification ===" && \
    ls -la /web/build/ && \
    ls -la /web/build/default/ | head -5 && \
    ls -la /web/build/berry/ | head -5 && \
    ls -la /web/build/air/ | head -5

# Go builder stage
FROM golang:alpine AS builder2

RUN apk add --no-cache \
    gcc \
    musl-dev \
    sqlite-dev \
    build-base

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOOS=linux

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /web/build ./web/build

RUN go build -trimpath -ldflags "-s -w -X 'github.com/songquanpeng/one-api/common.Version=$(cat VERSION)' -linkmode external -extldflags '-static'" -o one-api

# Final stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder2 /build/one-api /

EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/one-api"]