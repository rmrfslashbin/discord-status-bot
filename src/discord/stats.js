// src/discord/stats.js - Bot statistics and metrics command

import { createLogger } from '../utils/logger.js'

// JSDoc type imports for documentation
/** @typedef {import('../types.js').DiscordInteraction} DiscordInteraction */
/** @typedef {import('../types.js').Configuration} Configuration */
/** @typedef {import('../types.js').KVStore} KVStore */
/** @typedef {import('../types.js').Logger} Logger */
/** @typedef {import('../types.js').StatsData} StatsData */
/** @typedef {import('../types.js').DiscordEmbed} DiscordEmbed */

/**
 * Handle the /status stats command
 * @param {DiscordInteraction} interaction - Discord interaction object
 * @param {Object} context - Application context (config, etc.)
 * @param {Configuration} context.config - Configuration instance
 * @returns {Promise<Object>} - Discord interaction response
 */
export async function handleStatsCommand(interaction, context) {
  const { config } = context
  const logger = createLogger('stats-command', {
    userId: interaction.member?.user?.id || interaction.user?.id,
    guildId: interaction.guild_id,
  })

  try {
    const timeframe = interaction.data?.options?.[0]?.options?.find(opt => opt.name === 'timeframe')?.value || '24h'

    logger.info('Processing stats command', { timeframe })

    const kvStore = config.getKvBinding()
    if (!kvStore) {
      logger.error('KV Store binding not available for stats')
      return {
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: '⚠️ Statistics are temporarily unavailable. Please try again later.',
          flags: 64, // EPHEMERAL
        },
      }
    }

    // Calculate time range
    const now = new Date()
    let startTime
    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - (60 * 60 * 1000))
        break
      case '24h':
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        break
      case '7d':
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
        break
      case '30d':
        startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
        break
      default:
        startTime = null // All time
    }

    // Gather statistics
    const stats = await gatherBotStats(kvStore, startTime, logger)

    // Format response
    const embed = createStatsEmbed(stats, timeframe, logger.getTraceId())

    logger.info('Stats command completed successfully')

    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [embed],
        flags: 64, // EPHEMERAL - only visible to the user who ran the command
      },
    }
  } catch (error) {
    logger.error('Error processing stats command', { error })
    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: '❌ An error occurred while generating statistics. Please try again later.',
        flags: 64, // EPHEMERAL
      },
    }
  }
}

/**
 * Gather statistics from KV storage
 * @param {KVStore} kvStore - KV storage binding
 * @param {Date|null} startTime - Start time for filtering (null for all time)
 * @param {Logger} logger - Logger instance
 * @returns {Promise<StatsData>} - Statistics object
 */
async function gatherBotStats(kvStore, startTime, logger) {
  const stats = {
    totalUsers: 0,
    totalStatusUpdates: 0,
    totalActivities: 0,
    activeUsers: new Set(),
    statusUpdatesInPeriod: 0,
    activitiesInPeriod: 0,
    topUsers: new Map(),
    averageStatusLength: 0,
    totalStatusLength: 0,
    errorCount: 0,
  }

  try {
    // Get all user status histories
    let listComplete = false
    let cursor = undefined
    const userStatusKeys = []

    logger.debug('Listing user status keys')
    while (!listComplete) {
      const listResult = await kvStore.list({
        prefix: 'user:',
        cursor: cursor,
        limit: 100,
      })

      for (const key of listResult.keys) {
        if (key.name.includes(':status_history')) {
          userStatusKeys.push(key.name)
        }
      }

      if (listResult.list_complete) {
        listComplete = true
      } else {
        cursor = listResult.cursor
      }
    }

    logger.debug('Processing user status histories', { count: userStatusKeys.length })

    // Process each user's status history
    for (const key of userStatusKeys) {
      const userId = key.split(':')[1]
      stats.totalUsers++

      try {
        const historyData = await kvStore.get(key, { type: 'json' })
        if (historyData && Array.isArray(historyData.history)) {
          const userStatusCount = historyData.history.length
          stats.totalStatusUpdates += userStatusCount

          // Check for activity in the specified time period
          let userActiveDuringPeriod = false
          let _userStatusInPeriod = 0

          for (const status of historyData.history) {
            const statusTime = new Date(status.timestamp)

            // Track average status length
            if (status.raw_input) {
              stats.totalStatusLength += status.raw_input.length
            }

            // Check if status falls within the time period
            if (!startTime || statusTime >= startTime) {
              stats.statusUpdatesInPeriod++
              // userStatusInPeriod++
              userActiveDuringPeriod = true
            }
          }

          if (userActiveDuringPeriod) {
            stats.activeUsers.add(userId)
          }

          // Track top users
          stats.topUsers.set(userId, userStatusCount)
        }
      } catch (userError) {
        logger.warn('Error processing user status history', {
          userId,
          error: userError.message,
        })
        stats.errorCount++
      }
    }

    // Get activity statistics
    logger.debug('Listing activity keys')
    listComplete = false
    cursor = undefined

    while (!listComplete) {
      const listResult = await kvStore.list({
        prefix: 'activity:',
        cursor: cursor,
        limit: 100,
      })

      for (const key of listResult.keys) {
        stats.totalActivities++

        if (startTime) {
          try {
            const activityData = await kvStore.get(key.name, { type: 'json' })
            if (activityData) {
              const activityTime = new Date(activityData.timestamp)
              if (activityTime >= startTime) {
                stats.activitiesInPeriod++
              }
            }
          } catch (activityError) {
            logger.warn('Error processing activity', {
              activityKey: key.name,
              error: activityError.message,
            })
            stats.errorCount++
          }
        }
      }

      if (listResult.list_complete) {
        listComplete = true
      } else {
        cursor = listResult.cursor
      }
    }

    // Calculate averages
    if (stats.totalStatusUpdates > 0) {
      stats.averageStatusLength = Math.round(stats.totalStatusLength / stats.totalStatusUpdates)
    }

    logger.info('Statistics gathering completed', {
      totalUsers: stats.totalUsers,
      totalStatusUpdates: stats.totalStatusUpdates,
      activeUsers: stats.activeUsers.size,
      errorCount: stats.errorCount,
    })

    return stats
  } catch (error) {
    logger.error('Error gathering bot statistics', { error })
    throw error
  }
}

/**
 * Create a Discord embed with bot statistics
 * @param {StatsData} stats - Statistics object
 * @param {string} timeframe - Time frame for the statistics
 * @param {string} traceId - Trace ID for debugging
 * @returns {DiscordEmbed} - Discord embed object
 */
function createStatsEmbed(stats, timeframe, traceId) {
  // Sort top users by status count
  const topUsersList = Array.from(stats.topUsers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry, index) => `${index + 1}. <@${entry[0]}> (${entry[1]} updates)`)
    .join('\n') || '_No data available_'

  const timeframeNames = {
    '1h': 'Last Hour',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    'all': 'All Time',
  }

  const periodName = timeframeNames[timeframe] || 'Selected Period'
  const isAllTime = timeframe === 'all'

  return {
    title: '📊 Bot Usage Statistics',
    description: `Statistics for **${periodName}**`,
    color: 0x5865F2, // Discord blurple
    fields: [
      {
        name: '👥 Users',
        value: [
          `Total Users: **${stats.totalUsers.toLocaleString()}**`,
          !isAllTime ? `Active in Period: **${stats.activeUsers.size.toLocaleString()}**` : null,
        ].filter(Boolean).join('\n'),
        inline: true,
      },
      {
        name: '📝 Status Updates',
        value: [
          `Total Updates: **${stats.totalStatusUpdates.toLocaleString()}**`,
          !isAllTime ? `In Period: **${stats.statusUpdatesInPeriod.toLocaleString()}**` : null,
          `Average Length: **${stats.averageStatusLength} chars**`,
        ].filter(Boolean).join('\n'),
        inline: true,
      },
      {
        name: '🎯 Activities',
        value: [
          `Total Activities: **${stats.totalActivities.toLocaleString()}**`,
          !isAllTime ? `In Period: **${stats.activitiesInPeriod.toLocaleString()}**` : null,
        ].filter(Boolean).join('\n'),
        inline: true,
      },
      {
        name: '🏆 Top Active Users',
        value: topUsersList,
        inline: false,
      },
    ],
    footer: {
      text: `Generated at ${new Date().toLocaleTimeString()} • Trace: ${traceId}`,
    },
    timestamp: new Date().toISOString(),
  }
}