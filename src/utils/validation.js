// src/utils/validation.js - Comprehensive input validation

import { createLogger } from './logger.js'
import { ValidationError } from './errors.js'

// JSDoc type imports
/** @typedef {import('../types.js').Logger} Logger */

/**
 * Input validation utility class
 */
export class InputValidator {
  constructor(logger = null) {
    this.logger = logger || createLogger('input-validator')
  }

  /**
   * Validate Discord user ID
   * @param {*} userId - User ID to validate
   * @param {string} [fieldName='userId'] - Field name for errors
   * @returns {string} - Validated user ID
   * @throws {ValidationError}
   */
  validateUserId(userId, fieldName = 'userId') {
    if (!userId) {
      throw new ValidationError('User ID is required', fieldName, userId, 'REQUIRED', this.logger?.getTraceId())
    }

    if (typeof userId !== 'string') {
      throw new ValidationError('User ID must be a string', fieldName, userId, 'INVALID_TYPE', this.logger?.getTraceId())
    }

    // Discord snowflake IDs are 17-19 digits
    if (!/^\d{17,19}$/.test(userId)) {
      this.logger.warn('Invalid user ID format', { userId: userId.substring(0, 8) + '...' })
      throw new ValidationError('Invalid user ID format', fieldName, userId, 'INVALID_FORMAT', this.logger?.getTraceId())
    }

    return userId
  }

  /**
   * Validate Discord channel ID
   * @param {*} channelId - Channel ID to validate
   * @param {string} [fieldName='channelId'] - Field name for errors
   * @returns {string} - Validated channel ID
   * @throws {ValidationError}
   */
  validateChannelId(channelId, fieldName = 'channelId') {
    if (!channelId) {
      throw new ValidationError('Channel ID is required', fieldName, channelId, 'REQUIRED')
    }

    if (typeof channelId !== 'string') {
      throw new ValidationError('Channel ID must be a string', fieldName, channelId, 'INVALID_TYPE')
    }

    // Discord snowflake IDs are 17-19 digits
    if (!/^\d{17,19}$/.test(channelId)) {
      this.logger.warn('Invalid channel ID format', { channelId })
      throw new ValidationError('Invalid channel ID format', fieldName, channelId, 'INVALID_FORMAT')
    }

    return channelId
  }

  /**
   * Validate and sanitize status text input
   * @param {*} statusText - Status text to validate
   * @param {string} [fieldName='statusText'] - Field name for errors
   * @param {number} [maxLength=2000] - Maximum allowed length
   * @returns {string} - Sanitized status text
   * @throws {ValidationError}
   */
  validateStatusText(statusText, fieldName = 'statusText', maxLength = 2000) {
    if (!statusText) {
      throw new ValidationError('Status text is required', fieldName, statusText, 'REQUIRED')
    }

    if (typeof statusText !== 'string') {
      throw new ValidationError('Status text must be a string', fieldName, statusText, 'INVALID_TYPE')
    }

    // Trim whitespace
    const trimmed = statusText.trim()

    if (trimmed.length === 0) {
      throw new ValidationError('Status text cannot be empty', fieldName, statusText, 'EMPTY')
    }

    if (trimmed.length > maxLength) {
      this.logger.warn('Status text exceeds maximum length', {
        length: trimmed.length,
        maxLength,
        preview: trimmed.substring(0, 50) + '...',
      })
      throw new ValidationError(
        `Status text exceeds maximum length of ${maxLength} characters`,
        fieldName,
        trimmed,
        'TOO_LONG',
      )
    }

    // Check for suspicious content patterns
    this.validateContentSafety(trimmed, fieldName)

    return trimmed
  }

  /**
   * Validate content for safety (XSS, injection attempts, etc.)
   * @param {string} content - Content to validate
   * @param {string} fieldName - Field name for errors
   * @throws {ValidationError}
   */
  validateContentSafety(content, fieldName) {
    // Check for potential XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
    ]

    for (const pattern of xssPatterns) {
      if (pattern.test(content)) {
        this.logger.warn('Potentially malicious content detected', {
          pattern: pattern.toString(),
          preview: content.substring(0, 100) + '...',
        })
        throw new ValidationError(
          'Content contains potentially unsafe elements',
          fieldName,
          content,
          'UNSAFE_CONTENT',
          this.logger?.getTraceId(),
        )
      }
    }

    // Check for SQL injection patterns (even though we don't use SQL)
    // Made less aggressive to avoid false positives on normal text
    const sqlPatterns = [
      /(union\s+select)/gi,
      /(drop\s+table)/gi,
      /(insert\s+into)/gi,
      /(delete\s+from)/gi,
      /(update\s+set)/gi,
      /(\'\s*or\s*\'\w*\'\s*=\s*\'\w*)/gi, // ' or '1'='1' patterns
      /(;\s*drop)/gi, // Semicolon followed by drop
      /(-{2,}\s*(drop|union|select|delete|insert|update))/gi, // SQL comments before SQL keywords
    ]

    for (const pattern of sqlPatterns) {
      if (pattern.test(content)) {
        this.logger.warn('Potential SQL injection attempt detected', {
          pattern: pattern.toString(),
          preview: content.substring(0, 100) + '...',
        })
        throw new ValidationError(
          'Content contains potentially malicious patterns',
          fieldName,
          content,
          'MALICIOUS_PATTERN',
          this.logger?.getTraceId(),
        )
      }
    }
  }

  /**
   * Validate Discord interaction signature
   * @param {*} signature - Ed25519 signature
   * @param {*} timestamp - Request timestamp
   * @param {*} body - Request body
   * @param {string} publicKey - Discord public key
   * @returns {boolean} - Whether signature is valid
   * @throws {ValidationError}
   */
  validateDiscordSignature(signature, timestamp, body, publicKey) {
    if (!signature) {
      throw new ValidationError('Discord signature is required', 'signature', signature, 'REQUIRED')
    }

    if (!timestamp) {
      throw new ValidationError('Discord timestamp is required', 'timestamp', timestamp, 'REQUIRED')
    }

    if (!body) {
      throw new ValidationError('Request body is required', 'body', body, 'REQUIRED')
    }

    if (!publicKey) {
      throw new ValidationError('Discord public key is required', 'publicKey', publicKey, 'REQUIRED')
    }

    // Validate signature format (hex string)
    if (typeof signature !== 'string' || !/^[0-9a-fA-F]+$/.test(signature)) {
      this.logger.warn('Invalid signature format', { signatureLength: signature?.length })
      throw new ValidationError('Invalid signature format', 'signature', signature, 'INVALID_FORMAT')
    }

    // Validate timestamp format (should be unix timestamp as string)
    if (typeof timestamp !== 'string' || !/^\d+$/.test(timestamp)) {
      this.logger.warn('Invalid timestamp format', { timestamp })
      throw new ValidationError('Invalid timestamp format', 'timestamp', timestamp, 'INVALID_FORMAT')
    }

    // Check timestamp age (reject requests older than 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const requestTime = parseInt(timestamp, 10)
    const age = now - requestTime

    if (age > 300) { // 5 minutes
      this.logger.warn('Request timestamp too old', { age, requestTime, now })
      throw new ValidationError('Request timestamp too old', 'timestamp', timestamp, 'EXPIRED')
    }

    if (age < -60) { // Allow up to 1 minute in the future for clock skew
      this.logger.warn('Request timestamp from future', { age, requestTime, now })
      throw new ValidationError('Request timestamp from future', 'timestamp', timestamp, 'FUTURE')
    }

    return true
  }

  /**
   * Validate emoji string
   * @param {*} emoji - Emoji to validate
   * @param {string} [fieldName='emoji'] - Field name for errors
   * @returns {string} - Validated emoji
   * @throws {ValidationError}
   */
  validateEmoji(emoji, fieldName = 'emoji') {
    if (!emoji) {
      throw new ValidationError('Emoji is required', fieldName, emoji, 'REQUIRED')
    }

    if (typeof emoji !== 'string') {
      throw new ValidationError('Emoji must be a string', fieldName, emoji, 'INVALID_TYPE')
    }

    const trimmed = emoji.trim()

    if (trimmed.length === 0) {
      throw new ValidationError('Emoji cannot be empty', fieldName, emoji, 'EMPTY')
    }

    // Basic emoji validation (allow standard emojis and Discord custom emoji format)
    // Standard emojis or Discord format like <:name:id> or <a:name:id>
    const emojiPattern = /^(?:[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|<a?:[a-zA-Z0-9_]+:\d+>|.{1,4})$/u

    if (!emojiPattern.test(trimmed)) {
      this.logger.warn('Invalid emoji format', { emoji: trimmed })
      throw new ValidationError('Invalid emoji format', fieldName, emoji, 'INVALID_FORMAT')
    }

    if (trimmed.length > 100) { // Reasonable limit for custom emoji formats
      throw new ValidationError('Emoji string too long', fieldName, emoji, 'TOO_LONG')
    }

    return trimmed
  }

  /**
   * Validate timezone string
   * @param {*} timezone - Timezone to validate
   * @param {string} [fieldName='timezone'] - Field name for errors
   * @returns {string} - Validated timezone
   * @throws {ValidationError}
   */
  validateTimezone(timezone, fieldName = 'timezone') {
    if (!timezone) {
      throw new ValidationError('Timezone is required', fieldName, timezone, 'REQUIRED')
    }

    if (typeof timezone !== 'string') {
      throw new ValidationError('Timezone must be a string', fieldName, timezone, 'INVALID_TYPE')
    }

    const trimmed = timezone.trim()

    // Basic timezone format validation (IANA format like America/New_York)
    const timezonePattern = /^[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)*$/

    if (!timezonePattern.test(trimmed)) {
      this.logger.warn('Invalid timezone format', { timezone: trimmed })
      throw new ValidationError(
        'Invalid timezone format. Use IANA format like America/New_York',
        fieldName,
        timezone,
        'INVALID_FORMAT',
      )
    }

    if (trimmed.length > 50) {
      throw new ValidationError('Timezone string too long', fieldName, timezone, 'TOO_LONG')
    }

    return trimmed
  }

  /**
   * Validate configuration values
   * @param {Object} config - Configuration object to validate
   * @returns {Object} - Validated configuration
   * @throws {ValidationError}
   */
  validateConfiguration(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Configuration must be an object', 'config', config, 'INVALID_TYPE')
    }

    const validated = {}

    // Validate Discord configuration
    if (config.discord) {
      validated.discord = {}

      if (config.discord.applicationId) {
        validated.discord.applicationId = this.validateUserId(config.discord.applicationId, 'discord.applicationId')
      }

      if (config.discord.statusChannelId) {
        validated.discord.statusChannelId = this.validateChannelId(config.discord.statusChannelId, 'discord.statusChannelId')
      }
    }

    // Validate numeric values
    if (config.llm) {
      validated.llm = {}

      if (config.llm.maxTokens !== undefined) {
        const maxTokens = parseInt(config.llm.maxTokens, 10)
        if (isNaN(maxTokens) || maxTokens <= 0 || maxTokens > 4000) {
          throw new ValidationError(
            'Max tokens must be a positive number <= 4000',
            'llm.maxTokens',
            config.llm.maxTokens,
            'INVALID_RANGE',
          )
        }
        validated.llm.maxTokens = maxTokens
      }

      if (config.llm.temperature !== undefined) {
        const temperature = parseFloat(config.llm.temperature)
        if (isNaN(temperature) || temperature < 0 || temperature > 2) {
          throw new ValidationError(
            'Temperature must be a number between 0 and 2',
            'llm.temperature',
            config.llm.temperature,
            'INVALID_RANGE',
          )
        }
        validated.llm.temperature = temperature
      }
    }

    return validated
  }
}

/**
 * Create a singleton validator instance
 */
const defaultValidator = new InputValidator()

/**
 * Convenience functions using the default validator
 */
export const validateUserId = (userId, fieldName) => defaultValidator.validateUserId(userId, fieldName)
export const validateChannelId = (channelId, fieldName) => defaultValidator.validateChannelId(channelId, fieldName)
export const validateStatusText = (statusText, fieldName, maxLength) => defaultValidator.validateStatusText(statusText, fieldName, maxLength)
export const validateEmoji = (emoji, fieldName) => defaultValidator.validateEmoji(emoji, fieldName)
export const validateTimezone = (timezone, fieldName) => defaultValidator.validateTimezone(timezone, fieldName)
export const validateDiscordSignature = (signature, timestamp, body, publicKey) => defaultValidator.validateDiscordSignature(signature, timestamp, body, publicKey)
export const validateConfiguration = config => defaultValidator.validateConfiguration(config)