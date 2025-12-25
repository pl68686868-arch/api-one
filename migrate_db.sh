#!/bin/bash
# Database Migration Script - Add Channel Selection Tracking Fields
# Run this script on your local machine to apply migrations to the remote MySQL database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== One API Database Migration ===${NC}"
echo "Adding channel selection tracking fields to logs table..."
echo ""

# Database connection details
DB_HOST="192.3.44.143"
DB_CONTAINER="one-api-mysql"
DB_NAME="one_api"
DB_USER="oneapi"
DB_PASS="OneApiSuperPass2025Simple"

# Check if we can connect
echo -e "${YELLOW}Checking database connection...${NC}"
if ! ssh root@${DB_HOST} "docker exec ${DB_CONTAINER} mysql -u${DB_USER} -p${DB_PASS} -e 'SELECT 1' ${DB_NAME} > /dev/null 2>&1"; then
    echo -e "${RED}ERROR: Cannot connect to database${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database connection OK${NC}"
echo ""

# Backup check
echo -e "${YELLOW}IMPORTANT: Make sure you have a database backup!${NC}"
read -p "Have you backed up the database? (yes/no): " backup_confirm
if [[ ! "$backup_confirm" =~ ^[Yy]es$ ]]; then
    echo -e "${RED}Migration cancelled. Please backup your database first.${NC}"
    exit 1
fi
echo ""

# Run migrations
echo -e "${YELLOW}Running migrations...${NC}"

# Create migration SQL
MIGRATION_SQL="
-- Add new tracking fields
ALTER TABLE logs ADD COLUMN IF NOT EXISTS channel_health_score FLOAT DEFAULT 0 COMMENT 'Channel success rate at time of selection (0-1)';
ALTER TABLE logs ADD COLUMN IF NOT EXISTS available_channels INT DEFAULT 0 COMMENT 'Number of channels available for this model';
ALTER TABLE logs ADD COLUMN IF NOT EXISTS actual_model VARCHAR(255) DEFAULT '' COMMENT 'Actual model after channel mapping';
ALTER TABLE logs ADD COLUMN IF NOT EXISTS selection_score FLOAT DEFAULT 0 COMMENT 'Selection score used for channel ranking';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_logs_health_score ON logs(channel_health_score);
CREATE INDEX IF NOT EXISTS idx_logs_actual_model ON logs(actual_model);
CREATE INDEX IF NOT EXISTS idx_logs_available_channels ON logs(available_channels);

-- Verify changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_DEFAULT, 
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = '${DB_NAME}' 
    AND TABLE_NAME = 'logs' 
    AND COLUMN_NAME IN ('channel_health_score', 'available_channels', 'actual_model', 'selection_score')
ORDER BY ORDINAL_POSITION;
"

# Execute migration
echo "Applying schema changes..."
ssh root@${DB_HOST} "docker exec -i ${DB_CONTAINER} mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME}" <<EOF
${MIGRATION_SQL}
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Migration Summary ===${NC}"
echo "Added columns:"
echo "  - channel_health_score (FLOAT)"
echo "  - available_channels (INT)"
echo "  - actual_model (VARCHAR 255)"
echo "  - selection_score (FLOAT)"
echo ""
echo "Added indexes:"
echo "  - idx_logs_health_score"
echo "  - idx_logs_actual_model"
echo "  - idx_logs_available_channels"
echo ""

# Show final status
echo -e "${YELLOW}Verifying indexes...${NC}"
ssh root@${DB_HOST} "docker exec ${DB_CONTAINER} mysql -u${DB_USER} -p${DB_PASS} -e \"SHOW INDEX FROM logs WHERE Key_name LIKE 'idx_logs_%'\" ${DB_NAME}"

echo ""
echo -e "${GREEN}✓ Migration complete! You can now restart the application.${NC}"
EOF
