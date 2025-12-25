#!/bin/bash
# Quick Migration Script - Direct Execution (No Confirmation)
# Use this if you're absolutely sure and want to skip confirmations

DB_HOST="192.3.44.143"
DB_CONTAINER="one-api-mysql"
DB_NAME="one_api"
DB_USER="oneapi"
DB_PASS="OneApiSuperPass2025Simple"

echo "Running migration on ${DB_HOST}..."

ssh root@${DB_HOST} "docker exec -i ${DB_CONTAINER} mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME}" <<'EOF'
-- Add new fields
ALTER TABLE logs ADD COLUMN IF NOT EXISTS channel_health_score FLOAT DEFAULT 0;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS available_channels INT DEFAULT 0;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS actual_model VARCHAR(255) DEFAULT '';
ALTER TABLE logs ADD COLUMN IF NOT EXISTS selection_score FLOAT DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_logs_health_score ON logs(channel_health_score);
CREATE INDEX IF NOT EXISTS idx_logs_actual_model ON logs(actual_model);

-- Show result
SHOW COLUMNS FROM logs LIKE '%channel%';
SHOW COLUMNS FROM logs LIKE '%actual_model%';
SHOW COLUMNS FROM logs LIKE '%selection%';
EOF

echo "Done!"
