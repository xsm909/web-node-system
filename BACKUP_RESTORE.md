# Database Backup and Restore Guide

This guide describes how to perform a full snapshot of the PostgreSQL database running in Docker and how to restore it.

## 1. Automated Script (Recommended)

A helper script is provided at `scripts/db-manager.sh`.

### To create a backup:
```bash
./scripts/db-manager.sh backup
```
The backup will be saved in the `backups/` directory with a timestamp.

### To restore a backup:
```bash
./scripts/db-manager.sh restore backups/backup_filename.sql
```

---

## 2. Manual Commands

If you prefer to run commands manually, follow these steps:

### Create a Backup
Run the following command to create a full snapshot of the database:
```bash
docker exec -t web-node-system-db-1 pg_dumpall -c -U user > backup_$(date +%Y%m%d_%H%M%S).sql
```
*Note: Replace `web-node-system-db-1` with your actual database container name if it differs.*

### Restore a Backup
To restore the database from a `.sql` file:
```bash
cat your_backup_file.sql | docker exec -i web-node-system-db-1 psql -U user
```

---

## 3. Configuration Details
- **Database User:** `user`
- **Database Name:** `workflow_db`
- **Container Name:** `web-node-system-db-1` (default by docker-compose)
