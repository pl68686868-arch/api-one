# 🚀 One API - Deploy với MySQL + Redis + Cloudflare Zero Trust

## Kiến trúc

```
Internet → Cloudflare Tunnel → Server
                                  ├── One API (port 3000)
                                  ├── MySQL (port 3306)
                                  └── Redis (port 6379)
```

---

## Bước 1: SSH vào Server & Cài Docker

```bash
ssh user@your-server-ip

# Cài Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout và login lại
```

---

## Bước 2: Clone Repo

```bash
mkdir -p /opt/one-api && cd /opt/one-api
git clone https://github.com/pl68686868-arch/api-one.git .
```

---

## Bước 3: Tạo docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ========== One API ==========
  one-api:
    build: .
    container_name: one-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      - TZ=Asia/Ho_Chi_Minh
      # MySQL connection
      - SQL_DSN=oneapi:OneApiPassword123@tcp(mysql:3306)/oneapi
      # Log riêng database (optional)
      - LOG_SQL_DSN=oneapi:OneApiPassword123@tcp(mysql:3306)/oneapi_logs
      # Redis
      - REDIS_CONN_STRING=redis://redis:6379
      - SYNC_FREQUENCY=60
      # Cache
      - MEMORY_CACHE_ENABLED=true
      # AI Features
      - AUTO_MODEL_ENABLED=true
      # Session
      - SESSION_SECRET=your-secret-key-here-change-me
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - one-api-network

  # ========== MySQL 8.0 ==========
  mysql:
    image: mysql:8.0
    container_name: one-api-mysql
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=RootPassword123
      - MYSQL_DATABASE=oneapi
      - MYSQL_USER=oneapi
      - MYSQL_PASSWORD=OneApiPassword123
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql-init:/docker-entrypoint-initdb.d
    command: 
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-authentication-plugin=mysql_native_password
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pRootPassword123"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - one-api-network

  # ========== Redis ==========
  redis:
    image: redis:7-alpine
    container_name: one-api-redis
    restart: always
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - one-api-network

  # ========== Cloudflare Tunnel ==========
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: always
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - one-api-network

networks:
  one-api-network:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
EOF
```

---

## Bước 4: Tạo MySQL Init Script (tạo database logs)

```bash
mkdir -p mysql-init
cat > mysql-init/01-create-logs-db.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS oneapi_logs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON oneapi_logs.* TO 'oneapi'@'%';
FLUSH PRIVILEGES;
EOF
```

---

## Bước 5: Cấu hình Cloudflare Zero Trust

### 5.1. Vào Cloudflare Dashboard
1. Đăng nhập: https://dash.cloudflare.com
2. Vào **Zero Trust** → **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Đặt tên: `one-api-tunnel`
5. Copy **Tunnel Token**

### 5.2. Tạo file .env

```bash
cat > .env << 'EOF'
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
EOF
```

### 5.3. Cấu hình Public Hostname
Trong Cloudflare Dashboard:
- **Public hostname**: `api.yourdomain.com`
- **Service**: `http://one-api:3000`
- **Additional settings**:
  - ✅ No TLS Verify (vì internal traffic)
  - ✅ HTTP Host Header: `api.yourdomain.com`

---

## Bước 6: Chạy

```bash
# Pull images và build
docker compose pull
docker compose up -d --build

# Xem logs
docker compose logs -f one-api

# Kiểm tra services
docker compose ps
```

---

## Bước 7: Kiểm tra

```bash
# Local health check
curl http://localhost:3000/api/status

# Qua Cloudflare
curl https://api.yourdomain.com/api/status
```

---

## Environment Variables Quan trọng

| Variable | Mô tả | Ví dụ |
|----------|-------|-------|
| `SQL_DSN` | MySQL connection | `user:pass@tcp(mysql:3306)/oneapi` |
| `LOG_SQL_DSN` | Logs database (optional) | `user:pass@tcp(mysql:3306)/oneapi_logs` |
| `REDIS_CONN_STRING` | Redis URL | `redis://redis:6379` |
| `SYNC_FREQUENCY` | Cache sync interval (seconds) | `60` |
| `MEMORY_CACHE_ENABLED` | Enable memory cache | `true` |
| `AUTO_MODEL_ENABLED` | Enable virtual models | `true` |
| `SESSION_SECRET` | Session encryption key | Random string |

---

## Redis Configuration

Redis được dùng cho:
- **Rate limiting** - Giới hạn request
- **Session storage** - Lưu session user
- **Cache sync** - Đồng bộ cache giữa nhiều instance

### Redis Sentinel (High Availability)

```yaml
environment:
  - REDIS_CONN_STRING=redis-sentinel-1:26379,redis-sentinel-2:26379
  - REDIS_MASTER_NAME=mymaster
  - REDIS_PASSWORD=your-redis-password
```

---

## Troubleshooting

```bash
# Kiểm tra MySQL
docker exec -it one-api-mysql mysql -u oneapi -pOneApiPassword123 -e "SHOW DATABASES;"

# Kiểm tra Redis
docker exec -it one-api-redis redis-cli ping

# Kiểm tra Cloudflare Tunnel
docker logs cloudflared

# Restart all
docker compose restart
```

---

## Backup Database

```bash
# Backup MySQL
docker exec one-api-mysql mysqldump -u root -pRootPassword123 --all-databases > backup.sql

# Restore
docker exec -i one-api-mysql mysql -u root -pRootPassword123 < backup.sql
```
