#!/usr/bin/env node

/**
 * KV Migration Script
 * 
 * This script helps migrate KV data between environments or perform
 * data transformations during updates.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import readline from 'node:readline'
import chalk from 'chalk'

/**
 * Execute wrangler command
 */
function execWrangler(command) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    return output.trim()
  } catch (error) {
    console.error(chalk.red('Error executing wrangler command:'), error.message)
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
 * Get all key-value pairs from namespace
 */
function getAllData(namespaceId) {
  console.log(chalk.blue('📋 Fetching all data...'))
  
  // Get all keys
  const listCommand = `wrangler kv key list --namespace-id ${namespaceId}`
  const keysOutput = execWrangler(listCommand)
  const keys = JSON.parse(keysOutput).map(key => key.name)
  
  console.log(chalk.green(`✅ Found ${keys.length} keys`))
  
  // Get all values
  const data = {}
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    process.stdout.write(`\r   Progress: ${i + 1}/${keys.length} - ${key.substring(0, 30)}...`)
    
    try {
      const getCommand = `wrangler kv key get "${key}" --namespace-id ${namespaceId}`
      const value = execWrangler(getCommand)
      
      // Try to parse as JSON
      try {
        data[key] = JSON.parse(value)
      } catch {
        data[key] = value
      }
    } catch (error) {
      console.error(chalk.yellow(`\nWarning: Could not get value for key '${key}'`))
      data[key] = null
    }
  }
  
  console.log() // New line after progress
  return data
}

/**
 * Set key-value pair
 */
function setKeyValue(namespaceId, key, value) {
  try {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
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
 * Data transformation functions
 */
const MIGRATIONS = {
  /**
   * Example: Add version field to user data
   */
  addVersionToUsers: (data) => {
    const transformed = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('user:') && typeof value === 'object' && value !== null) {
        transformed[key] = {
          ...value,
          version: '2.0',
          migrated_at: new Date().toISOString()
        }
      } else {
        transformed[key] = value
      }
    }
    return transformed
  },

  /**
   * Example: Rename old activity keys to new format
   */
  renameActivityKeys: (data) => {
    const transformed = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('user_activity:')) {
        // Rename to new format
        const newKey = key.replace('user_activity:', 'activity:')
        transformed[newKey] = value
      } else {
        transformed[key] = value
      }
    }
    return transformed
  },

  /**
   * Example: Clean up old test data
   */
  cleanupTestData: (data) => {
    const transformed = {}
    for (const [key, value] of Object.entries(data)) {
      // Skip test data
      if (key.includes('test:') || key.includes('debug:')) {
        console.log(chalk.gray(`   Skipping test key: ${key}`))
        continue
      }
      transformed[key] = value
    }
    return transformed
  },

  /**
   * Example: Update profile structure
   */
  updateProfileStructure: (data) => {
    const transformed = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('user:') && typeof value === 'object' && value !== null) {
        // Update profile structure
        if (value.profile) {
          transformed[key] = {
            ...value,
            profile: {
              ...value.profile,
              settings: value.profile.settings || {},
              preferences: value.profile.preferences || {},
              updated_at: new Date().toISOString()
            }
          }
        } else {
          transformed[key] = value
        }
      } else {
        transformed[key] = value
      }
    }
    return transformed
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
 * Main migration function
 */
async function migrateKV(sourceEnv, targetEnv, migrationName, options = {}) {
  console.log(chalk.blue.bold(`\n🔄 KV Migration Tool\n`))
  console.log(chalk.gray('=' .repeat(50)))
  
  // List available migrations if none specified
  if (!migrationName) {
    console.log(chalk.blue('📋 Available migrations:'))
    Object.keys(MIGRATIONS).forEach((name, index) => {
      console.log(chalk.cyan(`   ${index + 1}. ${name}`))
    })
    console.log(chalk.blue('\n💡 Usage: node migrate-kv.js <source-env> <target-env> <migration-name>'))
    console.log(chalk.gray('   Example: node migrate-kv.js development staging addVersionToUsers'))
    return
  }

  // Check if migration exists
  if (!MIGRATIONS[migrationName]) {
    console.error(chalk.red(`❌ Migration '${migrationName}' not found`))
    console.log(chalk.gray('Available migrations:', Object.keys(MIGRATIONS).join(', ')))
    process.exit(1)
  }

  // Get namespace IDs
  console.log(chalk.blue(`📂 Source environment: ${sourceEnv}`))
  const sourceNamespaceId = getNamespaceId(sourceEnv)
  console.log(chalk.green(`✅ Source namespace ID: ${sourceNamespaceId}`))

  console.log(chalk.blue(`🎯 Target environment: ${targetEnv}`))
  const targetNamespaceId = getNamespaceId(targetEnv)
  console.log(chalk.green(`✅ Target namespace ID: ${targetNamespaceId}`))

  // Safety check
  if (targetEnv === 'production' && !options.force) {
    console.log(chalk.red('\n🚨 WARNING: Migrating to PRODUCTION environment!'))
    const confirm = await promptConfirmation('Are you absolutely sure you want to continue?')
    if (!confirm) {
      console.log(chalk.gray('Migration cancelled'))
      return
    }
  }

  // Get source data
  const sourceData = getAllData(sourceNamespaceId)
  console.log(chalk.green(`✅ Retrieved ${Object.keys(sourceData).length} keys from source`))

  // Create backup of source data
  const backupDir = './backups'
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(backupDir, `migration-backup-${sourceEnv}-${timestamp}.json`)
  
  const backup = {
    metadata: {
      timestamp: new Date().toISOString(),
      sourceEnvironment: sourceEnv,
      targetEnvironment: targetEnv,
      migration: migrationName,
      totalKeys: Object.keys(sourceData).length
    },
    data: sourceData
  }
  
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2))
  console.log(chalk.green(`✅ Created backup: ${backupFile}`))

  // Apply migration
  console.log(chalk.blue(`\n🔄 Applying migration: ${migrationName}`))
  const migrationFunction = MIGRATIONS[migrationName]
  const transformedData = migrationFunction(sourceData)
  
  const originalCount = Object.keys(sourceData).length
  const transformedCount = Object.keys(transformedData).length
  
  console.log(chalk.green(`✅ Migration applied`))
  console.log(chalk.cyan(`   • Original keys: ${originalCount}`))
  console.log(chalk.cyan(`   • Transformed keys: ${transformedCount}`))
  console.log(chalk.cyan(`   • Difference: ${transformedCount - originalCount}`))

  // Confirm before writing to target
  if (!options.force) {
    const proceed = await promptConfirmation(`Write ${transformedCount} keys to ${targetEnv}?`)
    if (!proceed) {
      console.log(chalk.gray('Migration cancelled'))
      return
    }
  }

  // Write transformed data to target
  console.log(chalk.blue('\n💾 Writing transformed data to target...'))
  const keys = Object.keys(transformedData)
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = transformedData[key]
    
    process.stdout.write(`\r   Progress: ${i + 1}/${keys.length} - ${key.substring(0, 30)}...`)
    
    if (value !== null) {
      const success = setKeyValue(targetNamespaceId, key, value)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    } else {
      errorCount++
    }
  }

  console.log() // New line after progress

  // Results
  console.log(chalk.gray('=' .repeat(50)))
  console.log(chalk.green.bold('✅ Migration completed!'))
  console.log(chalk.green(`   • Source: ${sourceEnv}`))
  console.log(chalk.green(`   • Target: ${targetEnv}`))
  console.log(chalk.green(`   • Migration: ${migrationName}`))
  console.log(chalk.green(`   • Keys migrated: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.yellow(`   • Errors: ${errorCount}`))
  }
  console.log(chalk.green(`   • Backup saved: ${backupFile}`))

  console.log(chalk.gray('\n💡 Test the target environment to verify the migration'))
  console.log()
}

// CLI handling
const args = process.argv.slice(2)
const sourceEnv = args[0]
const targetEnv = args[1] 
const migrationName = args[2]
const options = {
  force: args.includes('--force') || args.includes('-f')
}

if (!sourceEnv || !targetEnv) {
  console.log(chalk.blue.bold('\n🔄 KV Migration Tool\n'))
  console.log(chalk.yellow('Usage: node migrate-kv.js <source-env> <target-env> [migration-name] [--force]'))
  console.log(chalk.gray('\nExamples:'))
  console.log(chalk.gray('  node migrate-kv.js development staging'))
  console.log(chalk.gray('  node migrate-kv.js development staging addVersionToUsers'))
  console.log(chalk.gray('  node migrate-kv.js production staging cleanupTestData --force'))
  process.exit(1)
}

// Check if wrangler is available
try {
  execSync('wrangler --version', { stdio: 'pipe' })
} catch (error) {
  console.error(chalk.red('❌ Wrangler CLI not found. Please install it first:'))
  console.error(chalk.gray('   npm install -g wrangler'))
  process.exit(1)
}

// Run migration
migrateKV(sourceEnv, targetEnv, migrationName, options).catch(error => {
  console.error(chalk.red('\n❌ Migration failed:'), error.message)
  process.exit(1)
})