#!/usr/bin/env node

/**
 * KV Restore Script
 * 
 * This script restores KV data from a backup file created by backup-kv.js.
 * It can restore to any environment and provides safety checks.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import readline from 'node:readline'
import chalk from 'chalk'

// Configuration
const BACKUP_DIR = './backups'

/**
 * Execute wrangler command
 */
function execWrangler(command) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    return output.trim()
  } catch (error) {
    console.error(chalk.red('Error executing wrangler command:'), error.message)
    if (error.stdout) console.error('stdout:', error.stdout)
    if (error.stderr) console.error('stderr:', error.stderr)
    throw error
  }
}

/**
 * Get KV namespace ID for environment
 */
function getNamespaceId(environment) {
  try {
    const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf-8')
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
 * List available backup files
 */
function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log(chalk.yellow('⚠️  No backup directory found'))
    return []
  }
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('kv-backup-') && file.endsWith('.json'))
    .map(file => {
      const filepath = path.join(BACKUP_DIR, file)
      const stats = fs.statSync(filepath)
      return {
        name: file,
        path: filepath,
        mtime: stats.mtime,
        size: stats.size
      }
    })
    .sort((a, b) => b.mtime - a.mtime) // Most recent first
  
  return files
}

/**
 * Load and validate backup file
 */
function loadBackup(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    const backup = JSON.parse(content)
    
    // Validate backup structure
    if (!backup.metadata || !backup.data) {
      throw new Error('Invalid backup file structure')
    }
    
    if (!backup.metadata.timestamp || !backup.metadata.environment) {
      throw new Error('Missing required metadata in backup file')
    }
    
    return backup
  } catch (error) {
    console.error(chalk.red('Error loading backup file:'), error.message)
    process.exit(1)
  }
}

/**
 * Set KV key-value pair
 */
function setKeyValue(namespaceId, key, value) {
  try {
    // Convert value to string if it's an object
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
    
    // Escape quotes in the value for command line
    const escapedValue = valueStr.replace(/"/g, '\\"')
    
    const command = `wrangler kv key put "${key}" "${escapedValue}" --namespace-id ${namespaceId}`
    execWrangler(command)
    return true
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not set key '${key}':`, error.message))
    return false
  }
}

/**
 * Get current KV data for comparison
 */
function getCurrentKeys(namespaceId) {
  try {
    const command = `wrangler kv key list --namespace-id ${namespaceId}`
    const output = execWrangler(command)
    const keys = JSON.parse(output)
    return keys.map(key => key.name)
  } catch (error) {
    console.log(chalk.yellow('Warning: Could not list current keys:', error.message))
    return []
  }
}

/**
 * Prompt user for confirmation
 */
function promptConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    rl.question(chalk.yellow(`${message} (y/N): `), (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * Main restore function
 */
async function restoreKV(backupFile, targetEnvironment, options = {}) {
  console.log(chalk.blue.bold(`\n🔄 KV Restore Tool\n`))
  console.log(chalk.gray('=' .repeat(50)))
  
  // List available backups if no file specified
  if (!backupFile) {
    console.log(chalk.blue('📁 Available backup files:'))
    const backups = listBackupFiles()
    
    if (backups.length === 0) {
      console.log(chalk.yellow('   No backup files found'))
      console.log(chalk.gray(`   Run backup-kv.js first to create a backup`))
      return
    }
    
    backups.forEach((backup, index) => {
      const sizeKB = Math.round(backup.size / 1024 * 100) / 100
      const age = Math.round((Date.now() - backup.mtime.getTime()) / (1000 * 60 * 60))
      console.log(chalk.cyan(`   ${index + 1}. ${backup.name}`))
      console.log(chalk.gray(`      Size: ${sizeKB} KB, Age: ${age}h`))
    })
    
    console.log(chalk.blue('\n💡 Usage: node restore-kv.js <backup-file> <environment>'))
    console.log(chalk.gray('   Example: node restore-kv.js kv-backup-production-2024-01-15T10-30-00.json development'))
    return
  }
  
  // Load backup file
  const backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(BACKUP_DIR, backupFile)
  
  if (!fs.existsSync(backupPath)) {
    console.error(chalk.red(`❌ Backup file not found: ${backupPath}`))
    process.exit(1)
  }
  
  console.log(chalk.blue(`📂 Loading backup: ${backupFile}`))
  const backup = loadBackup(backupPath)
  
  // Display backup info
  console.log(chalk.green('✅ Backup loaded successfully'))
  console.log(chalk.cyan(`   • Source environment: ${backup.metadata.environment}`))
  console.log(chalk.cyan(`   • Backup date: ${new Date(backup.metadata.timestamp).toLocaleString()}`))
  console.log(chalk.cyan(`   • Total keys: ${backup.metadata.totalKeys}`))
  console.log(chalk.cyan(`   • Backup version: ${backup.metadata.backupVersion || '1.0'}`))
  
  // Get target namespace
  console.log(chalk.blue(`\n🎯 Target environment: ${targetEnvironment}`))
  const targetNamespaceId = getNamespaceId(targetEnvironment)
  console.log(chalk.green(`✅ Target namespace ID: ${targetNamespaceId}`))
  
  // Check current data in target
  const currentKeys = getCurrentKeys(targetNamespaceId)
  if (currentKeys.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Target environment has ${currentKeys.length} existing keys`))
    
    if (!options.force) {
      const proceed = await promptConfirmation('This will overwrite existing data. Continue?')
      if (!proceed) {
        console.log(chalk.gray('Restore cancelled'))
        return
      }
    }
  }
  
  // Safety check for production
  if (targetEnvironment === 'production' && !options.force) {
    console.log(chalk.red('\n🚨 WARNING: Restoring to PRODUCTION environment!'))
    const confirm = await promptConfirmation('Are you absolutely sure you want to continue?')
    if (!confirm) {
      console.log(chalk.gray('Restore cancelled'))
      return
    }
  }
  
  // Perform restore
  console.log(chalk.blue('\n💾 Restoring data...'))
  const keys = Object.keys(backup.data)
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = backup.data[key]
    
    process.stdout.write(`\r   Progress: ${i + 1}/${keys.length} - ${key.substring(0, 30)}...`)
    
    if (value !== null) {
      const success = setKeyValue(targetNamespaceId, key, value)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    } else {
      // Skip null values (they were errors in the backup)
      errorCount++
    }
  }
  
  console.log() // New line after progress
  
  // Results
  console.log(chalk.gray('=' .repeat(50)))
  console.log(chalk.green.bold('✅ Restore completed!'))
  console.log(chalk.green(`   • Target environment: ${targetEnvironment}`))
  console.log(chalk.green(`   • Keys restored: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.yellow(`   • Errors: ${errorCount}`))
  }
  
  // Show data summary
  console.log(chalk.blue('\n📊 Restored Data Summary:'))
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
  
  console.log(chalk.gray('\n💡 Verify the restore by testing the bot in the target environment'))
  console.log()
}

// CLI handling
const args = process.argv.slice(2)
const backupFile = args[0]
const targetEnvironment = args[1] || 'development'
const options = {
  force: args.includes('--force') || args.includes('-f')
}

// Check if wrangler is available
try {
  execSync('wrangler --version', { stdio: 'pipe' })
} catch (error) {
  console.error(chalk.red('❌ Wrangler CLI not found. Please install it first:'))
  console.error(chalk.gray('   npm install -g wrangler'))
  process.exit(1)
}

// Run restore
restoreKV(backupFile, targetEnvironment, options).catch(error => {
  console.error(chalk.red('\n❌ Restore failed:'), error.message)
  process.exit(1)
})