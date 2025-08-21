// src/utils/errors.js - Error class hierarchy and handling

/**
 * Base error class for all application errors
 */
export class BaseError extends Error {
  /**
   * Create a base error
   * @param {string} message - Error message
   * @param {string} [code] - Error code
   * @param {Object} [context] - Additional error context
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code = 'UNKNOWN_ERROR', context = {}, cause = null) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.context = context
    this.cause = cause
    this.timestamp = new Date().toISOString()

    // Maintain proper stack trace for where our error was thrown (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Convert error to JSON for logging
   * @returns {Object} - JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : null,
    }
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    return false // Override in subclasses
  }

  /**
   * Get HTTP status code for this error
   * @returns {number}
   */
  getHttpStatusCode() {
    return 500 // Override in subclasses
  }

  /**
   * Get user-friendly message
   * @returns {string}
   */
  getUserMessage() {
    return 'An unexpected error occurred. Please try again later.'
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends BaseError {
  constructor(message, code = 'CONFIG_ERROR', context = {}, cause = null) {
    super(message, code, context, cause)
  }

  getHttpStatusCode() {
    return 500
  }

  getUserMessage() {
    return 'The service is temporarily unavailable due to configuration issues.'
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {*} value - Invalid value
   * @param {string} [code] - Error code
   */
  constructor(message, field, value, code = 'VALIDATION_ERROR') {
    super(message, code, { field, value })
    this.field = field
    this.value = value
  }

  getHttpStatusCode() {
    return 400
  }

  getUserMessage() {
    return `Invalid input: ${this.message}`
  }
}

/**
 * Discord API-related errors
 */
export class DiscordApiError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {number} [statusCode] - HTTP status code from Discord
   * @param {Object} [discordResponse] - Discord API response
   * @param {string} [endpoint] - Discord API endpoint
   */
  constructor(message, statusCode = null, discordResponse = null, endpoint = null, code = 'DISCORD_API_ERROR') {
    super(message, code, { statusCode, discordResponse, endpoint })
    this.statusCode = statusCode
    this.discordResponse = discordResponse
    this.endpoint = endpoint
  }

  isRetryable() {
    // Retry on 429 (rate limit), 500+ server errors
    return this.statusCode === 429 || (this.statusCode >= 500 && this.statusCode < 600)
  }

  getHttpStatusCode() {
    // Map Discord status codes to appropriate responses
    switch (this.statusCode) {
      case 400: return 400 // Bad Request
      case 401: return 500 // Unauthorized (our config issue)
      case 403: return 403 // Forbidden
      case 404: return 404 // Not Found
      case 429: return 429 // Rate Limited
      default: return 502 // Bad Gateway
    }
  }

  getUserMessage() {
    switch (this.statusCode) {
      case 429:
        return 'Discord is rate limiting requests. Please try again in a moment.'
      case 403:
        return 'The bot lacks permission to perform this action.'
      case 404:
        return 'The requested Discord resource was not found.'
      default:
        return 'Discord service is temporarily unavailable. Please try again later.'
    }
  }
}

/**
 * LLM API-related errors
 */
export class LLMApiError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} provider - LLM provider (anthropic, openai, etc.)
   * @param {number} [statusCode] - HTTP status code
   * @param {Object} [apiResponse] - API response
   */
  constructor(message, provider, statusCode = null, apiResponse = null, code = 'LLM_API_ERROR') {
    super(message, code, { provider, statusCode, apiResponse })
    this.provider = provider
    this.statusCode = statusCode
    this.apiResponse = apiResponse
  }

  isRetryable() {
    // Retry on rate limits, server errors, but not on invalid API keys
    return this.statusCode === 429 ||
           (this.statusCode >= 500 && this.statusCode < 600) ||
           this.statusCode === 502 ||
           this.statusCode === 503
  }

  getHttpStatusCode() {
    switch (this.statusCode) {
      case 400: return 400 // Bad Request
      case 401: return 500 // API key issue (our config problem)
      case 429: return 429 // Rate Limited
      default: return 502 // Bad Gateway
    }
  }

  getUserMessage() {
    switch (this.statusCode) {
      case 429:
        return 'AI service is temporarily busy. Please try again in a moment.'
      case 401:
        return 'AI service authentication failed. Please contact support.'
      default:
        return 'AI service is temporarily unavailable. Your status will be processed with basic formatting.'
    }
  }
}

/**
 * Storage-related errors
 */
export class StorageError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} [operation] - Storage operation that failed
   * @param {string} [key] - Storage key involved
   */
  constructor(message, operation = null, key = null, code = 'STORAGE_ERROR') {
    super(message, code, { operation, key })
    this.operation = operation
    this.key = key
  }

  isRetryable() {
    // Most storage errors are retryable (temporary issues)
    return true
  }

  getHttpStatusCode() {
    return 500
  }

  getUserMessage() {
    return 'Data storage is temporarily unavailable. Please try again later.'
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} [userId] - User ID involved
   * @param {string} [action] - Action that was attempted
   */
  constructor(message, userId = null, action = null, code = 'AUTH_ERROR') {
    super(message, code, { userId, action })
    this.userId = userId
    this.action = action
  }

  getHttpStatusCode() {
    return 401
  }

  getUserMessage() {
    return 'Authentication failed. Please try the command again.'
  }
}

/**
 * Permission-related errors
 */
export class PermissionError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} [requiredPermission] - Permission that was required
   * @param {string} [resource] - Resource that was accessed
   */
  constructor(message, requiredPermission = null, resource = null, code = 'PERMISSION_ERROR') {
    super(message, code, { requiredPermission, resource })
    this.requiredPermission = requiredPermission
    this.resource = resource
  }

  getHttpStatusCode() {
    return 403
  }

  getUserMessage() {
    return 'You do not have permission to perform this action.'
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {number} [retryAfter] - Seconds to wait before retrying
   * @param {string} [limitType] - Type of rate limit (user, global, etc.)
   */
  constructor(message, retryAfter = null, limitType = null, code = 'RATE_LIMIT_ERROR') {
    super(message, code, { retryAfter, limitType })
    this.retryAfter = retryAfter
    this.limitType = limitType
  }

  isRetryable() {
    return true
  }

  getHttpStatusCode() {
    return 429
  }

  getUserMessage() {
    const waitTime = this.retryAfter ? ` Please wait ${this.retryAfter} seconds before trying again.` : ''
    return `You're sending commands too quickly.${waitTime}`
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {number} [timeoutMs] - Timeout duration in milliseconds
   * @param {string} [operation] - Operation that timed out
   */
  constructor(message, timeoutMs = null, operation = null, code = 'TIMEOUT_ERROR') {
    super(message, code, { timeoutMs, operation })
    this.timeoutMs = timeoutMs
    this.operation = operation
  }

  isRetryable() {
    return true
  }

  getHttpStatusCode() {
    return 504
  }

  getUserMessage() {
    return 'The operation took too long to complete. Please try again.'
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} [resource] - Resource that was not found
   * @param {string} [identifier] - Resource identifier
   */
  constructor(message, resource = null, identifier = null, code = 'NOT_FOUND_ERROR') {
    super(message, code, { resource, identifier })
    this.resource = resource
    this.identifier = identifier
  }

  getHttpStatusCode() {
    return 404
  }

  getUserMessage() {
    return 'The requested resource was not found.'
  }
}

/**
 * Conflict errors
 */
export class ConflictError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {string} [resource] - Resource with conflict
   * @param {string} [conflictReason] - Reason for conflict
   */
  constructor(message, resource = null, conflictReason = null, code = 'CONFLICT_ERROR') {
    super(message, code, { resource, conflictReason })
    this.resource = resource
    this.conflictReason = conflictReason
  }

  getHttpStatusCode() {
    return 409
  }

  getUserMessage() {
    return 'The operation conflicts with the current state. Please refresh and try again.'
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  /**
   * Create error from HTTP response
   * @param {Response} response - HTTP response object
   * @param {string} [service] - Service name (discord, anthropic, etc.)
   * @param {Object} [context] - Additional context
   * @returns {BaseError}
   */
  static fromHttpResponse(response, service = 'unknown', context = {}) {
    const statusCode = response.status
    const message = `HTTP ${statusCode} from ${service}`

    if (service === 'discord' || service.includes('discord')) {
      return new DiscordApiError(message, statusCode, null, context.endpoint)
    }

    if (['anthropic', 'openai', 'openrouter'].includes(service)) {
      return new LLMApiError(message, service, statusCode)
    }

    return new BaseError(message, 'HTTP_ERROR', { statusCode, service, ...context })
  }

  /**
   * Create error from JavaScript Error
   * @param {Error} error - JavaScript error
   * @param {Object} [context] - Additional context
   * @returns {BaseError}
   */
  static fromError(error, context = {}) {
    if (error instanceof BaseError) {
      return error
    }

    // Map common error types
    if (error.name === 'ValidationError') {
      return new ValidationError(error.message, context.field, context.value)
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new TimeoutError('Network request failed', null, 'fetch', error)
    }

    return new BaseError(error.message, 'JS_ERROR', context, error)
  }

  /**
   * Create storage error
   * @param {Error} error - Original error
   * @param {string} operation - Storage operation
   * @param {string} [key] - Storage key
   * @returns {StorageError}
   */
  static storageError(error, operation, key = null) {
    return new StorageError(error.message, operation, key, error)
  }

  /**
   * Create timeout error
   * @param {string} operation - Operation that timed out
   * @param {number} timeoutMs - Timeout duration
   * @returns {TimeoutError}
   */
  static timeoutError(operation, timeoutMs) {
    return new TimeoutError(`${operation} timed out after ${timeoutMs}ms`, timeoutMs, operation)
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Convert error to HTTP response
   * @param {Error} error - Error to convert
   * @param {string} [traceId] - Request trace ID
   * @returns {Response}
   */
  static toHttpResponse(error, traceId = null) {
    let statusError

    if (error instanceof BaseError) {
      statusError = error
    } else {
      statusError = ErrorFactory.fromError(error)
    }

    const responseBody = {
      success: false,
      error: statusError.name,
      message: statusError.getUserMessage(),
      code: statusError.code,
      timestamp: new Date().toISOString(),
    }

    if (traceId) {
      responseBody.traceId = traceId
    }

    // Include additional context in development
    if (typeof process !== 'undefined' && process.env && process.env.ENVIRONMENT === 'development') {
      responseBody.debug = {
        originalMessage: statusError.message,
        context: statusError.context,
        stack: statusError.stack,
      }
    }

    return new Response(JSON.stringify(responseBody), {
      status: statusError.getHttpStatusCode(),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Convert error to Discord interaction response
   * @param {Error} error - Error to convert
   * @param {boolean} [ephemeral=true] - Whether response should be ephemeral
   * @returns {Object}
   */
  static toDiscordResponse(error, ephemeral = true) {
    let statusError

    if (error instanceof BaseError) {
      statusError = error
    } else {
      statusError = ErrorFactory.fromError(error)
    }

    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: `❌ ${statusError.getUserMessage()}`,
        flags: ephemeral ? 64 : 0,
      },
    }
  }

  /**
   * Check if error should trigger retry
   * @param {Error} error - Error to check
   * @param {number} [attemptCount=0] - Current attempt count
   * @param {number} [maxAttempts=3] - Maximum attempts
   * @returns {boolean}
   */
  static shouldRetry(error, attemptCount = 0, maxAttempts = 3) {
    if (attemptCount >= maxAttempts) {
      return false
    }

    if (error instanceof BaseError) {
      return error.isRetryable()
    }

    // Default: don't retry unknown errors
    return false
  }

  /**
   * Get retry delay in milliseconds
   * @param {number} attemptCount - Current attempt count (0-based)
   * @param {number} [baseDelay=1000] - Base delay in ms
   * @returns {number}
   */
  static getRetryDelay(attemptCount, baseDelay = 1000) {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount)
    const jitter = Math.random() * 0.1 * exponentialDelay
    return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
  }
}

// Re-export ValidationError for backward compatibility
export { ValidationError as InputValidationError }