# One API - AI-Powered Intelligence

## 🧠 AI Features

This fork includes AI-powered intelligence features:

- **Virtual Models**: `auto`, `auto-fast`, `auto-cheap`, `auto-vi`, `auto-code`, `auto-smart`
- **Smart Routing**: Strategy-based channel selection (balanced, performance, cost, resilient)
- **Vietnamese Detection**: Auto-detect Vietnamese content and route to optimized models
- **Health Dashboard**: Real-time provider health monitoring

## Quick Start

```bash
# Enable auto model
export AUTO_MODEL_ENABLED=true

# Run with Docker
docker compose up -d
```

## Using Virtual Models

```bash
curl -X POST $BASE_URL/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'

# Response headers show selection:
# X-Auto-Requested-Model: auto
# X-Auto-Selected-Model: gpt-4o-mini
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTO_MODEL_ENABLED` | Enable virtual models | `false` |
| `MEMORY_CACHE_ENABLED` | Enable memory cache | `false` |

## CI/CD

This project uses GitHub Actions for CI/CD:
- **Backend tests**: Go tests
- **Frontend build**: React build
- **Docker**: Build and push to Docker Hub
- **Deploy**: SSH deploy (optional)

### Required Secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `SERVER_HOST` | Deploy server IP (optional) |
| `SERVER_USER` | Deploy server username (optional) |
| `SERVER_SSH_KEY` | Deploy server SSH key (optional) |
