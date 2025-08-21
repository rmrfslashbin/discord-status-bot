# KV Data Management Guide

This guide covers backup, restoration, and migration of KV data for the Discord Status Bot.

## Overview

The bot stores all data in Cloudflare KV storage, including:
- User profiles and settings
- Status history and activity
- Custom emoji mappings
- Global statistics

**Important**: KV data is critical for bot functionality. Regular backups are essential for:
- Disaster recovery
- Environment migrations
- Data analysis
- Debugging issues

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `backup-kv.js` | Create backups of KV data | `node scripts/backup-kv.js [environment]` |
| `restore-kv.js` | Restore from backup | `node scripts/restore-kv.js <backup-file> [environment]` |
| `migrate-kv.js` | Migrate/transform data | `node scripts/migrate-kv.js <source> <target> [migration]` |

## Prerequisites

1. **Wrangler CLI** installed and authenticated:
   ```bash
   npm install -g wrangler
   wrangler auth login
   ```

2. **Environment access** - ensure you have access to the target environments

3. **Backup directory** - `./backups` will be created automatically

## Backup Operations

### Create a Backup

```bash
# Backup development environment (default)
npm run backup:kv

# Or directly with node
node scripts/backup-kv.js

# Backup specific environment
node scripts/backup-kv.js production
node scripts/backup-kv.js staging
```

### Backup Output

The script creates a JSON file with this structure:
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "environment": "production",
    "namespaceId": "abc123...",
    "totalKeys": 1250,
    "backupVersion": "1.0"
  },
  "data": {
    "user:123456789": { "profile": {...}, "settings": {...} },
    "activity:123456789": [...],
    "global:stats": {...}
  }
}
```

### Automatic Cleanup

- Keeps last **10 backups** per environment
- Automatically removes older backups
- Displays cleanup actions in output

### Backup Examples

```bash
# Quick backup before deployment
node scripts/backup-kv.js production

# Backup development data for testing
node scripts/backup-kv.js development

# Backup feature environment
node scripts/backup-kv.js feature-new-llm
```

## Restore Operations

### List Available Backups

```bash
# Show all available backup files
node scripts/restore-kv.js
```

Output:
```
📁 Available backup files:
   1. kv-backup-production-2024-01-15T10-30-00.json
      Size: 145.6 KB, Age: 2h
   2. kv-backup-development-2024-01-15T09-15-00.json
      Size: 23.4 KB, Age: 3h
```

### Restore from Backup

```bash
# Restore to development (default)
node scripts/restore-kv.js kv-backup-production-2024-01-15T10-30-00.json

# Restore to specific environment
node scripts/restore-kv.js kv-backup-production-2024-01-15T10-30-00.json staging

# Force restore without confirmation prompts
node scripts/restore-kv.js backup-file.json production --force
```

### Restore Safety Features

- **Confirmation prompts** for destructive operations
- **Extra warning** for production environment
- **Existing data check** - warns if target has data
- **Progress display** during restore
- **Error handling** - continues on individual key failures

### Restore Examples

```bash
# Copy production data to staging for testing
node scripts/restore-kv.js kv-backup-production-2024-01-15T10-30-00.json staging

# Restore development from last backup
node scripts/restore-kv.js kv-backup-development-2024-01-15T09-15-00.json development

# Emergency production restore
node scripts/restore-kv.js kv-backup-production-2024-01-15T08-00-00.json production --force
```

## Migration Operations

### Available Migrations

The migration script includes several built-in transformations:

| Migration | Purpose |
|-----------|---------|
| `addVersionToUsers` | Add version field to user data |
| `renameActivityKeys` | Rename old activity keys to new format |
| `cleanupTestData` | Remove test/debug data |
| `updateProfileStructure` | Update profile data structure |

### Run a Migration

```bash
# List available migrations
node scripts/migrate-kv.js

# Migrate with transformation
node scripts/migrate-kv.js development staging addVersionToUsers

# Migrate production data (with confirmation)
node scripts/migrate-kv.js production staging cleanupTestData

# Force migration without prompts
node scripts/migrate-kv.js development staging updateProfileStructure --force
```

### Migration Safety Features

- **Automatic backup** of source data before migration
- **Data transformation preview** showing changes
- **Confirmation prompts** for destructive operations
- **Production warnings** with extra confirmation
- **Progress tracking** during data transfer

### Custom Migrations

Add new migrations to `scripts/migrate-kv.js`:

```javascript
const MIGRATIONS = {
  // Add your custom migration
  myCustomMigration: (data) => {
    const transformed = {}
    for (const [key, value] of Object.entries(data)) {
      // Your transformation logic here
      if (key.startsWith('user:')) {
        transformed[key] = {
          ...value,
          newField: 'defaultValue'
        }
      } else {
        transformed[key] = value
      }
    }
    return transformed
  }
}
```

## Data Structure Reference

### User Data Keys

```
user:{discord_user_id}
```

Structure:
```json
{
  "profile": {
    "timezone": "America/New_York",
    "theme": "default",
    "visibility": "public",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "settings": {
    "notifications": true,
    "privacy_level": "normal"
  },
  "stats": {
    "total_updates": 42,
    "streak_days": 7,
    "last_update": "2024-01-15T10:00:00Z"
  }
}
```

### Activity Data Keys

```
activity:{discord_user_id}
```

Structure:
```json
[
  {
    "id": "act_123abc",
    "timestamp": "2024-01-15T10:00:00Z", 
    "type": "status_update",
    "data": {
      "status": "Working on the project",
      "processed": {...}
    }
  }
]
```

### Global Data Keys

```
global:stats
global:config
```

### Profile Data Keys

```
profile:{discord_user_id}
```

## Common Use Cases

### 1. Environment Setup

Copy production data to staging for testing:
```bash
# 1. Backup production
node scripts/backup-kv.js production

# 2. Restore to staging
node scripts/restore-kv.js kv-backup-production-YYYY-MM-DDTHH-mm-ss.json staging
```

### 2. Data Migration

Migrate from old to new data structure:
```bash
# 1. Create migration function in migrate-kv.js
# 2. Test on development first
node scripts/migrate-kv.js development staging updateProfileStructure

# 3. Apply to production
node scripts/migrate-kv.js production production updateProfileStructure
```

### 3. Disaster Recovery

Restore from backup after data loss:
```bash
# 1. Identify last good backup
node scripts/restore-kv.js

# 2. Restore from backup
node scripts/restore-kv.js kv-backup-production-YYYY-MM-DDTHH-mm-ss.json production --force
```

### 4. Data Cleanup

Remove test/debug data:
```bash
# Use migration to clean up
node scripts/migrate-kv.js production production cleanupTestData
```

### 5. Development Reset

Reset development environment:
```bash
# 1. Backup current state
node scripts/backup-kv.js development

# 2. Restore from clean production backup
node scripts/restore-kv.js kv-backup-production-clean.json development
```

## Best Practices

### 1. Regular Backups

Set up automated backups:
```bash
# Add to crontab for daily backups
0 2 * * * cd /path/to/bot && node scripts/backup-kv.js production
```

### 2. Pre-Deployment Backups

Always backup before deployments:
```bash
# In deployment script
node scripts/backup-kv.js production
wrangler deploy --env production
```

### 3. Environment Isolation

- Never restore production data to development without cleaning
- Use separate Discord servers for each environment
- Clean sensitive data before copying to lower environments

### 4. Backup Retention

- Keep daily backups for 30 days
- Keep weekly backups for 6 months
- Keep monthly backups for 1 year
- Store critical backups off-site

### 5. Testing Procedures

Before major changes:
```bash
# 1. Backup production
node scripts/backup-kv.js production

# 2. Copy to staging
node scripts/restore-kv.js latest-backup.json staging

# 3. Test changes on staging
# 4. If successful, apply to production
```

## Troubleshooting

### Common Issues

#### "Namespace not found"
```bash
# Check wrangler.toml for correct environment names
grep "^\[env\." wrangler.toml

# Verify namespace ID exists
wrangler kv namespace list
```

#### "Permission denied"
```bash
# Re-authenticate wrangler
wrangler auth login

# Check account/zone permissions
wrangler whoami
```

#### "Backup file corrupted"
```bash
# Validate JSON structure
node -e "console.log(JSON.parse(require('fs').readFileSync('backup.json')))"

# Check backup metadata
jq '.metadata' backup.json
```

#### "Large backup timeouts"
- Use `--timeout` flag with wrangler commands
- Break large migrations into smaller chunks
- Monitor progress and resume if needed

### Performance Tips

1. **Batch operations** - scripts already optimize batch size
2. **Parallel processing** - for very large datasets, consider splitting
3. **Network timeouts** - increase timeout for large backups
4. **Monitoring** - watch Cloudflare dashboard during operations

## Security Considerations

### Data Sensitivity

- User data may contain personal information
- Status updates may contain sensitive content
- Discord IDs are considered personal identifiers

### Backup Security

- Store backups in secure locations
- Encrypt sensitive backups at rest
- Limit access to backup files
- Clean up temporary backup files

### Access Control

- Limit who can access production KV data
- Use separate Cloudflare accounts for environments
- Rotate API keys regularly
- Monitor backup/restore operations

## Monitoring and Alerts

### Setup Monitoring

Monitor backup operations:
```bash
# Check backup file sizes
ls -lah backups/

# Verify backup contents
jq '.metadata' backups/latest-backup.json

# Test restore capability
node scripts/restore-kv.js --dry-run latest-backup.json development
```

### Automated Alerts

Set up alerts for:
- Failed backup operations
- Large changes in data size
- Restore operations on production
- Migration errors

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: KV Backup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install -g wrangler
      
      - name: Authenticate Wrangler
        run: wrangler auth login
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Create backup
        run: node scripts/backup-kv.js production
      
      - name: Upload backup to S3
        run: aws s3 cp backups/ s3://my-backup-bucket/ --recursive
```

This comprehensive KV data management system ensures your Discord bot's data is safe, recoverable, and manageable across all environments.