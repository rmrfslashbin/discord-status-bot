// src/utils/logger.js - Structured logging with trace IDs

/**
 * Generate a MongoDB ObjectID-style trace ID (24 hex characters)
 * Format: 8-char timestamp + 10-char machine/process + 6-char counter
 * @returns {string} - 24-character hex trace ID
 */
function generateTraceId() {
  // 4-byte timestamp (8 hex chars)
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')

  // 5-byte random value for machine/process (10 hex chars)
  const machineProcess = Array.from({ length: 5 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
  ).join('')

  // 3-byte counter (6 hex chars)
  const counter = (generateTraceId.counter = (generateTraceId.counter || 0) + 1)
  const counterHex = (counter % 0xFFFFFF).toString(16).padStart(6, '0')

  return `${timestamp}${machineProcess}${counterHex}`
}

/**
 * Logger class with structured logging and trace ID support
 * @class
 */
export class Logger {
  /**
   * Create a new Logger instance
   * @param {Object} [context={}] - Initial context data
   * @param {string} [context.component] - Component name
   * @param {string} [context.userId] - User ID
   * @param {string} [context.traceId] - Existing trace ID to use
   */
  constructor(context = {}) {
    /** @type {Object} */
    this.context = context
    /** @type {string} */
    this.traceId = context.traceId || generateTraceId()
  }

  /**
   * Create a child logger with additional context
   * @param {Object} additionalContext - Additional context to merge
   * @returns {Logger} - New logger instance with merged context
   */
  child(additionalContext = {}) {
    return new Logger({
      ...this.context,
      ...additionalContext,
      traceId: this.traceId, // Preserve parent trace ID
    })
  }

  /**
   * Log structured message with trace ID and context
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  _log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      traceId: this.traceId,
      message,
      ...this.context,
      ...meta,
    }

    // Use different console methods based on level
    switch (level) {
      case 'error':
        console.error(JSON.stringify(logEntry))
        break
      case 'warn':
        console.warn(JSON.stringify(logEntry))
        break
      case 'debug':
        console.debug(JSON.stringify(logEntry))
        break
      default:
        console.log(JSON.stringify(logEntry))
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta)
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta)
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata (can include error object)
   */
  error(message, meta = {}) {
    // If meta contains an Error object, extract useful properties
    if (meta.error instanceof Error) {
      meta.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: meta.error.stack,
      }
    }
    this._log('error', message, meta)
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta)
  }

  /**
   * Get the trace ID for this logger instance
   * @returns {string} - The trace ID
   */
  getTraceId() {
    return this.traceId
  }
}

/**
 * Create a logger instance for a specific module/component
 * @param {string} component - Component name (e.g., 'discord-api', 'llm-processor')
 * @param {Object} [additionalContext={}] - Additional context to include
 * @param {string} [additionalContext.userId] - User ID
 * @param {string} [additionalContext.guildId] - Guild ID
 * @param {string} [additionalContext.traceId] - Existing trace ID
 * @returns {Logger} - Logger instance
 */
export function createLogger(component, additionalContext = {}) {
  return new Logger({
    component,
    ...additionalContext,
  })
}

/**
 * Create a logger instance for a request with user context
 * @param {string} userId - Discord user ID
 * @param {string} component - Component name
 * @param {Object} [additionalContext={}] - Additional context
 * @param {string} [additionalContext.guildId] - Guild ID
 * @param {string} [additionalContext.channelId] - Channel ID
 * @param {number} [additionalContext.statusTextLength] - Status text length
 * @returns {Logger} - Logger instance
 */
export function createRequestLogger(userId, component, additionalContext = {}) {
  return new Logger({
    component,
    userId,
    ...additionalContext,
  })
}