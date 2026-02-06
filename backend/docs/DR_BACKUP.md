# Backup & Disaster Recovery

This project stores data in:
- SQLite database (`DATABASE_URL`, default `./data/context-os.db`)
- Qdrant vector collections (`user_{userId}_vectors`)

## SQLite Backup
1. Stop the API service (or ensure no writes).
2. Copy the database file:
```
cp ./data/context-os.db ./backups/context-os.db.$(date +%Y%m%d%H%M%S)
```

## SQLite Restore
1. Stop the API service.
2. Replace the database file:
```
cp ./backups/context-os.db.YYYYMMDDHHMMSS ./data/context-os.db
```
3. Restart the service.

## Qdrant Snapshot (Per Collection)
List collections:
```
curl -s http://qdrant:6333/collections | jq
```

Create snapshot:
```
curl -X POST http://qdrant:6333/collections/{collection_name}/snapshots
```

Download snapshot file from Qdrant storage:
```
./qdrant_storage/snapshots/{collection_name}/{snapshot_file}
```

## Qdrant Restore
1. Stop Qdrant.
2. Copy snapshot into Qdrant snapshots directory.
3. Start Qdrant and recover snapshot:
```
curl -X POST http://qdrant:6333/collections/{collection_name}/snapshots/{snapshot_file}/recover
```

## Rollback
- Roll back both SQLite and Qdrant snapshots from the same timestamp.
- If only SQLite is restored, vector data may become inconsistent.
