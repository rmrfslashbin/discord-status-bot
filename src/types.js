// src/types.js - JSDoc type definitions for the Discord Status Bot

/**
 * @fileoverview Type definitions using JSDoc for the Discord Status Bot.
 * These types help with development and documentation without requiring TypeScript.
 */

// =============================================================================
// Discord API Types
// =============================================================================

/**
 * @typedef {Object} DiscordUser
 * @property {string} id - The user's Discord ID
 * @property {string} username - The user's username
 * @property {string} discriminator - The user's 4-digit discriminator
 * @property {?string} avatar - The user's avatar hash
 * @property {?boolean} bot - Whether the user is a bot
 */

/**
 * @typedef {Object} DiscordInteraction
 * @property {string} id - Interaction ID
 * @property {string} application_id - Application ID
 * @property {number} type - Interaction type (1=PING, 2=APPLICATION_COMMAND, etc.)
 * @property {?Object} data - Interaction data (commands, components)
 * @property {?string} guild_id - Guild ID if in a guild
 * @property {?string} channel_id - Channel ID
 * @property {?Object} member - Guild member object
 * @property {?DiscordUser} user - User object (if not in guild)
 * @property {string} token - Interaction token
 * @property {number} version - Always 1
 */

/**
 * @typedef {Object} DiscordEmbed
 * @property {?string} title - Embed title
 * @property {?string} description - Embed description
 * @property {?number} color - Embed color as integer
 * @property {?DiscordEmbedField[]} fields - Array of embed fields
 * @property {?DiscordEmbedFooter} footer - Embed footer
 * @property {?string} timestamp - ISO timestamp string
 */

/**
 * @typedef {Object} DiscordEmbedField
 * @property {string} name - Field name
 * @property {string} value - Field value
 * @property {?boolean} inline - Whether field should be inline
 */

/**
 * @typedef {Object} DiscordEmbedFooter
 * @property {string} text - Footer text
 * @property {?string} icon_url - Footer icon URL
 */

/**
 * @typedef {Object} DiscordMessagePayload
 * @property {?string} content - Message content
 * @property {?DiscordEmbed[]} embeds - Array of embeds
 * @property {?Object[]} components - Array of message components
 * @property {?Object} allowed_mentions - Allowed mentions configuration
 * @property {?number} flags - Message flags (64 = EPHEMERAL)
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * @typedef {Object} Configuration
 * @property {Function} getValue - Get configuration value by key
 * @property {Function} get - Get entire configuration object
 * @property {Function} getKvBinding - Get KV namespace binding
 * @property {Function} set - Set configuration value
 */

/**
 * @typedef {Object} LLMConfig
 * @property {string} service - LLM service (anthropic, openai, openrouter)
 * @property {string} model - Model name
 * @property {number} max_tokens - Maximum tokens
 * @property {number} temperature - Temperature setting
 * @property {?string} api_endpoint - Custom API endpoint
 * @property {number} relevanceThreshold - Context relevance threshold
 */

/**
 * @typedef {Object} DiscordConfig
 * @property {string} statusChannelId - Channel for status messages
 * @property {string} publicKey - Discord public key for verification
 * @property {string} applicationId - Discord application ID
 * @property {string} botToken - Discord bot token
 */

// =============================================================================
// Status Data Types
// =============================================================================

/**
 * @typedef {Object} StatusData
 * @property {string} overall_status - Brief status phrase
 * @property {string} mood_emoji - Single mood emoji
 * @property {string} visual_theme - Theme name (work, gaming, social, etc.)
 * @property {string} accent_color - Hex color or color name
 * @property {StatusMetric[]} metrics - Array of status metrics
 * @property {PersonalState[]} personal_states - Array of personal states
 * @property {StatusHighlight[]} highlights - Array of highlights
 * @property {PersistentContext[]} persistent_context - Continuing context items
 * @property {string} narrative_summary - Summary description
 * @property {string[]} errors - Array of error messages
 * @property {?string} activity_id - Associated activity ID
 */

/**
 * @typedef {Object} StatusMetric
 * @property {string} name - Metric name
 * @property {string} value - Metric value as string
 * @property {number} value_rating - Numeric rating (1-5)
 * @property {string} trend - Trend indicator (improved, worsened, unchanged, new)
 * @property {string} icon - Emoji icon
 */

/**
 * @typedef {Object} PersonalState
 * @property {string} name - State name (arousal, tired, hunger, etc.)
 * @property {string} emoji - State emoji
 * @property {number} level - State level (1-5)
 * @property {string} trend - Trend indicator
 * @property {?string} time_since_last - Time since last occurrence
 */

/**
 * @typedef {Object} StatusHighlight
 * @property {string} type - Highlight type (activity, event, state, etc.)
 * @property {string} description - Highlight description
 * @property {?string} timeframe - Time context (current, future, past)
 * @property {boolean} is_new - Whether highlight is new
 */

/**
 * @typedef {Object} PersistentContext
 * @property {string} description - Context description
 * @property {boolean} from_previous - Whether carried from previous status
 * @property {?string} source_timestamp - Original timestamp
 */

/**
 * @typedef {Object} ProviderStatus
 * @property {boolean} healthy - Whether the provider is healthy
 * @property {string} provider - Provider name (anthropic, openai, openrouter)
 * @property {?number} responseTime - Response time in milliseconds
 * @property {?string} error - Error message if unhealthy
 * @property {string} lastChecked - ISO timestamp of last check
 */

/**
 * @typedef {Object} OverallHealth
 * @property {boolean} healthy - Whether any providers are healthy
 * @property {number} healthyProviders - Number of healthy providers
 * @property {number} totalProviders - Total number of configured providers
 * @property {string} lastChecked - ISO timestamp of last check
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {OverallHealth} overall - Overall health status
 * @property {Object<string, ProviderStatus>} providers - Status of each provider
 */

/**
 * @typedef {Object} StatusEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} raw_input - Original user input
 * @property {StatusData} processed_status - Processed status data
 * @property {?string} message_id - Discord message ID
 */

// =============================================================================
// User Profile Types
// =============================================================================

/**
 * @typedef {Object} UserProfile
 * @property {string} user_id - Discord user ID
 * @property {UserPreferences} preferences - User preferences
 * @property {Object.<string, string>} custom_emojis - Custom emoji mappings
 * @property {string} created_at - Profile creation timestamp
 * @property {string} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} UserPreferences
 * @property {?string} timezone - User's timezone
 * @property {?string} theme - Preferred theme
 * @property {?boolean} notifications_enabled - Notification preferences
 */

// =============================================================================
// Activity Types
// =============================================================================

/**
 * @typedef {Object} Activity
 * @property {string} id - Activity ID
 * @property {string} user_id - Creator user ID
 * @property {string} title - Activity title
 * @property {string} description - Activity description
 * @property {string} type - Activity type
 * @property {string} status - Activity status (active, completed, cancelled)
 * @property {string} created_at - Creation timestamp
 * @property {?string} scheduled_for - Scheduled time
 * @property {string[]} participants - Array of user IDs
 */

// =============================================================================
// Logging Types
// =============================================================================

/**
 * @typedef {Object} Logger
 * @property {string} traceId - Unique trace ID for request tracking
 * @property {Object} context - Logger context data
 * @property {Function} child - Create child logger with additional context
 * @property {Function} info - Log info message
 * @property {Function} warn - Log warning message
 * @property {Function} error - Log error message
 * @property {Function} debug - Log debug message
 * @property {Function} getTraceId - Get the trace ID
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level
 * @property {string} traceId - Request trace ID
 * @property {string} message - Log message
 * @property {string} component - Component name
 * @property {?string} userId - User ID if applicable
 * @property {Object} [meta] - Additional metadata
 */

// =============================================================================
// Storage Types
// =============================================================================

/**
 * @typedef {Object} KVStore
 * @property {Function} get - Get value from KV store
 * @property {Function} put - Put value to KV store
 * @property {Function} delete - Delete key from KV store
 * @property {Function} list - List keys with optional prefix/cursor
 */

/**
 * @typedef {Object} KVListResult
 * @property {KVKey[]} keys - Array of key objects
 * @property {boolean} list_complete - Whether listing is complete
 * @property {?string} cursor - Cursor for pagination
 */

/**
 * @typedef {Object} KVKey
 * @property {string} name - Key name
 * @property {?Object} metadata - Key metadata
 */

// =============================================================================
// Context and LLM Types
// =============================================================================

/**
 * @typedef {Object} ContextRelevance
 * @property {StatusEntry} entry - Original status entry
 * @property {Object} relevance_scores - Relevance scores by category
 * @property {number} overall_relevance - Overall relevance score
 */

/**
 * @typedef {Object} FilteredContext
 * @property {string} timestamp - Context timestamp
 * @property {string} raw_input - Original input
 * @property {Object} processed_status - Filtered processed status
 */

// =============================================================================
// API Response Types
// =============================================================================

/**
 * @typedef {Object} StatusUpdateResponse
 * @property {boolean} success - Whether update succeeded
 * @property {string} message - Response message
 * @property {string} userId - User ID
 * @property {string} messageId - Discord message ID
 * @property {?string} traceId - Request trace ID
 */

/**
 * @typedef {Object} StatsData
 * @property {number} totalUsers - Total number of users
 * @property {number} totalStatusUpdates - Total status updates
 * @property {number} totalActivities - Total activities created
 * @property {number} activeUsers - Active users in period
 * @property {number} statusUpdatesInPeriod - Updates in time period
 * @property {number} activitiesInPeriod - Activities in time period
 * @property {Map<string, number>} topUsers - Top users by activity
 * @property {number} averageStatusLength - Average status text length
 * @property {number} errorCount - Number of processing errors
 */

// =============================================================================
// Utility Export (not used at runtime, just for JSDoc)
// =============================================================================

export {}