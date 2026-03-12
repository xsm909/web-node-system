#!/bin/bash

# Configuration
CONTAINER_NAME="web-node-system-db-1"
DB_USER="user"
BACKUP_DIR="./backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

function show_usage() {
    echo "Usage: $0 {backup|restore} [backup_file]"
    echo "  backup               - Create a new database snapshot"
    echo "  restore [file.sql]   - Restore database from a specific SQL file"
    exit 1
}

function backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
    
    echo "Creating backup of $CONTAINER_NAME..."
    docker exec -t "$CONTAINER_NAME" pg_dumpall -c -U "$DB_USER" > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "Backup successful: $BACKUP_FILE"
    else
        echo "Error: Backup failed!"
        exit 1
    fi
}

function restore() {
    FILE=$1
    if [ -z "$FILE" ]; then
        echo "Error: Please specify the backup file to restore."
        show_usage
    fi

    if [ ! -f "$FILE" ]; then
        echo "Error: File '$FILE' not found."
        exit 1
    fi

    echo "Restoring database from $FILE..."
    cat "$FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER"
    
    if [ $? -eq 0 ]; then
        echo "Restore successful!"
    else
        echo "Error: Restore failed!"
        exit 1
    fi
}

case "$1" in
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    *)
        show_usage
        ;;
esac
