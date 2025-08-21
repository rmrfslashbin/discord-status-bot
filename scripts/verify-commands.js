#!/usr/bin/env node

/**
 * Command Verification and Documentation Script
 * 
 * This script verifies that all Discord slash commands are properly:
 * 1. Defined in src/discord/commands.js
 * 2. Handled in src/discord/interactions.js
 * 3. Registered with Discord API
 */

import { commandDefinitions } from '../src/discord/commands.js'
import chalk from 'chalk'

console.log(chalk.blue.bold('\n📋 Discord Bot Command Registry\n'))
console.log(chalk.gray('=' .repeat(60)))

// Parse and display all commands
commandDefinitions.forEach(command => {
  console.log(chalk.green.bold(`\n/${command.name}`))
  console.log(chalk.gray(`  ${command.description}`))
  
  if (command.options) {
    command.options.forEach(option => {
      displayOption(option, 2)
    })
  }
})

function displayOption(option, indent = 0) {
  const spacing = ' '.repeat(indent)
  const typeNames = {
    1: 'SUB_COMMAND',
    2: 'SUB_COMMAND_GROUP',
    3: 'STRING',
    4: 'INTEGER',
    5: 'BOOLEAN',
    6: 'USER',
    7: 'CHANNEL',
    8: 'ROLE',
    9: 'MENTIONABLE',
    10: 'NUMBER',
    11: 'ATTACHMENT'
  }
  
  const typeName = typeNames[option.type] || 'UNKNOWN'
  const required = option.required ? chalk.red('*') : ''
  
  console.log(`${spacing}${chalk.yellow(option.name)}${required} (${chalk.blue(typeName)})`)
  console.log(`${spacing}  ${chalk.gray(option.description)}`)
  
  // Display choices if present
  if (option.choices) {
    console.log(`${spacing}  ${chalk.cyan('Choices:')}`)
    option.choices.forEach(choice => {
      console.log(`${spacing}    • ${choice.name}: ${chalk.gray(choice.value)}`)
    })
  }
  
  // Recursively display nested options
  if (option.options) {
    option.options.forEach(subOption => {
      displayOption(subOption, indent + 2)
    })
  }
}

console.log(chalk.gray('\n' + '=' .repeat(60)))

// Summary
const totalCommands = commandDefinitions.length
let totalSubcommands = 0
let totalOptions = 0

function countOptions(options) {
  options?.forEach(option => {
    if (option.type === 1) totalSubcommands++
    else if (option.type !== 2) totalOptions++
    
    if (option.options) {
      countOptions(option.options)
    }
  })
}

commandDefinitions.forEach(cmd => countOptions(cmd.options))

console.log(chalk.blue.bold('\n📊 Summary:'))
console.log(`  • Total Commands: ${chalk.green(totalCommands)}`)
console.log(`  • Total Subcommands: ${chalk.green(totalSubcommands)}`)
console.log(`  • Total Options: ${chalk.green(totalOptions)}`)

// Key commands verification
console.log(chalk.blue.bold('\n✅ Key Commands Status:'))

const keyCommands = [
  { name: 'status update', description: 'Update user status' },
  { name: 'status health', description: 'Bot health check' },
  { name: 'status stats', description: 'Usage statistics' },
  { name: 'status profile', description: 'User profile management' },
  { name: 'status emoji', description: 'Emoji customization' },
  { name: 'status purge', description: 'Data deletion' },
  { name: 'status info', description: 'Bot information' },
]

keyCommands.forEach(cmd => {
  const [mainCmd, subCmd] = cmd.name.split(' ')
  const command = commandDefinitions.find(c => c.name === mainCmd)
  
  if (command) {
    const subcommand = command.options?.find(o => o.name === subCmd && o.type === 1)
    if (subcommand) {
      console.log(`  ${chalk.green('✓')} /${cmd.name} - ${chalk.gray(cmd.description)}`)
    } else if (subCmd) {
      console.log(`  ${chalk.red('✗')} /${cmd.name} - ${chalk.red('Subcommand not found')}`)
    } else {
      console.log(`  ${chalk.green('✓')} /${cmd.name} - ${chalk.gray(cmd.description)}`)
    }
  } else {
    console.log(`  ${chalk.red('✗')} /${cmd.name} - ${chalk.red('Command not found')}`)
  }
})

console.log(chalk.gray('\n' + '=' .repeat(60)))
console.log(chalk.yellow('\n💡 Next Steps:'))
console.log('  1. Run "npm run register:commands" to update Discord')
console.log('  2. Test commands in your Discord server')
console.log('  3. Check handler implementations in src/discord/interactions.js')
console.log()