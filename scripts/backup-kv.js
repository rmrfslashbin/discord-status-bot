#!/usr/bin/env node

/**
 * KV Backup Script
 * 
 * This script creates a backup of all KV data from a specified environment.
 * It exports data in JSON format for easy restoration and debugging.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import chalk from 'chalk'

// Configuration
const BACKUP_DIR = './backups'
const MAX_BACKUPS = 10 // Keep last 10 backups

/**
 * Execute wrangler command and return parsed JSON output
 */
function execWrangler(command) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    return output.trim()
  } catch (error) {
    console.error(chalk.red('Error executing wrangler command:'), error.message)
    if (error.stdout) console.error('stdout:', error.stdout)
    if (error.stderr) console.error('stderr:', error.stderr)
    process.exit(1)
  }
}

/**
 * Get KV namespace ID for environment
 */
function getNamespaceId(environment) {
  try {
    // Read wrangler.toml to extract namespace ID
    const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf-8')
    
    // Parse the TOML file for the environment's KV namespace
    const envSection = wranglerConfig.match(new RegExp(`\\[env\\.${environment}\\][\\s\\S]*?(?=\\[env\\.|$)`, 'i'))
    if (!envSection) {
      throw new Error(`Environment '${environment}' not found in wrangler.toml`)
    }
    
    const namespaceMatch = envSection[0].match(/id = "([^"]+)"/)
    if (!namespaceMatch) {
      throw new Error(`KV namespace ID not found for environment '${environment}'`)
    }
    
    return namespaceMatch[1]
  } catch (error) {
    console.error(chalk.red('Error reading wrangler.toml:'), error.message)
    process.exit(1)
  }
}

/**
 * List all keys in the KV namespace
 */
function listAllKeys(namespaceId) {
  console.log(chalk.blue('📋 Listing all keys...'))
  
  const command = `wrangler kv key list --namespace-id ${namespaceId}`
  const output = execWrangler(command)
  
  try {
    const keys = JSON.parse(output)
    return keys.map(key => key.name)
  } catch (error) {
    console.error(chalk.red('Error parsing key list:'), error.message)
    return []
  }
}

/**
 * Get value for a specific key
 */
function getKeyValue(namespaceId, key) {
  try {
    const command = `wrangler kv key get "${key}" --namespace-id ${namespaceId}`
    return execWrangler(command)
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not get value for key '${key}':`, error.message))
    return null
  }
}

/**
 * Create backup filename with timestamp
 */
function createBackupFilename(environment) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `kv-backup-${environment}-${timestamp}.json`
}

/**
 * Clean up old backups
 */
function cleanupOldBackups(environment) {
  if (!fs.existsSync(BACKUP_DIR)) return
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith(`kv-backup-${environment}-`) && file.endsWith('.json'))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_DIR, file),
      mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime) // Most recent first
  
  if (files.length > MAX_BACKUPS) {
    const filesToDelete = files.slice(MAX_BACKUPS)
    console.log(chalk.yellow(`🧹 Cleaning up ${filesToDelete.length} old backup(s)...`))
    
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path)
      console.log(chalk.gray(`   Deleted: ${file.name}`))
    })
  }
}

/**
 * Main backup function
 */
async function backupKV(environment = 'development') {
  console.log(chalk.blue.bold(`\n🗄️  KV Backup Tool\n`))
  console.log(chalk.gray('=' .repeat(50)))
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    console.log(chalk.green(`✅ Created backup directory: ${BACKUP_DIR}`))
  }
  
  // Get namespace ID
  console.log(chalk.blue(`🔍 Getting namespace ID for environment: ${environment}`))
  const namespaceId = getNamespaceId(environment)
  console.log(chalk.green(`✅ Found namespace ID: ${namespaceId}`))
  
  // List all keys
  const keys = listAllKeys(namespaceId)
  console.log(chalk.green(`✅ Found ${keys.length} keys to backup`))
  
  if (keys.length === 0) {
    console.log(chalk.yellow('⚠️  No data to backup'))
    return
  }
  
  // Backup data
  console.log(chalk.blue('💾 Backing up data...'))
  const backup = {
    metadata: {
      timestamp: new Date().toISOString(),
      environment,
      namespaceId,
      totalKeys: keys.length,
      backupVersion: '1.0'
    },
    data: {}
  }
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    process.stdout.write(`\r   Progress: ${i + 1}/${keys.length} - ${key.substring(0, 30)}...`)
    
    const value = getKeyValue(namespaceId, key)
    if (value !== null) {
      // Try to parse as JSON, store as string if not valid JSON
      try {
        backup.data[key] = JSON.parse(value)
      } catch {
        backup.data[key] = value
      }
      successCount++
    } else {
      backup.data[key] = null
      errorCount++
    }
  }
  
  console.log() // New line after progress
  
  // Save backup file
  const filename = createBackupFilename(environment)
  const filepath = path.join(BACKUP_DIR, filename)
  
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))
  
  // Calculate file size
  const stats = fs.statSync(filepath)
  const fileSizeKB = Math.round(stats.size / 1024 * 100) / 100
  
  // Results
  console.log(chalk.gray('=' .repeat(50)))
  console.log(chalk.green.bold('✅ Backup completed successfully!'))
  console.log(chalk.green(`   • Environment: ${environment}`))
  console.log(chalk.green(`   • Keys backed up: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.yellow(`   • Errors: ${errorCount}`))
  }
  console.log(chalk.green(`   • File size: ${fileSizeKB} KB`))
  console.log(chalk.green(`   • Saved to: ${filepath}`))
  
  // Clean up old backups
  cleanupOldBackups(environment)
  
  // Show backup file contents summary
  console.log(chalk.blue('\n📊 Backup Summary:'))
  const keysByPrefix = {}
  Object.keys(backup.data).forEach(key => {
    const prefix = key.split(':')[0]
    keysByPrefix[prefix] = (keysByPrefix[prefix] || 0) + 1
  })
  
  Object.entries(keysByPrefix)
    .sort(([,a], [,b]) => b - a)
    .forEach(([prefix, count]) => {
      console.log(chalk.cyan(`   • ${prefix}: ${count} keys`))
    })
  
  console.log(chalk.gray('\n💡 Use restore-kv.js to restore this backup'))
  console.log()
}

// CLI handling
const args = process.argv.slice(2)
const environment = args[0] || 'development'

// Validate environment
const validEnvironments = ['development', 'production', 'staging']
if (args[0] && !validEnvironments.includes(environment) && !args[0].startsWith('feature-')) {
  console.log(chalk.yellow(`⚠️  Warning: '${environment}' is not a standard environment`))
  console.log(chalk.gray('Standard environments: development, production, staging'))
  console.log(chalk.gray('Custom environments (starting with "feature-") are also supported'))
  console.log()
}

// Check if wrangler is available
try {
  execSync('wrangler --version', { stdio: 'pipe' })
} catch (error) {
  console.error(chalk.red('❌ Wrangler CLI not found. Please install it first:'))
  console.error(chalk.gray('   npm install -g wrangler'))
  process.exit(1)
}

// Run backup
backupKV(environment).catch(error => {
  console.error(chalk.red('\n❌ Backup failed:'), error.message)
  process.exit(1)
})