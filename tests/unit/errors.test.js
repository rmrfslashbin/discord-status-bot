// Unit tests for error handling system
import { describe, it, expect } from 'vitest'
import {
  BaseError,
  ValidationError,
  LLMApiError,
  DiscordApiError,
  StorageError,
  TimeoutError,
  ErrorFactory,
  ErrorHandler,
} from '../../src/utils/errors.js'

describe('Error Handling System', () => {
  describe('BaseError', () => {
    it('should create error with all properties', () => {
      const error = new BaseError('Test message', 'TEST_CODE', { key: 'value' }, new Error('Original'))
      
      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.context).toEqual({ key: 'value' })
      expect(error.cause).toBeInstanceOf(Error)
      expect(error.timestamp).toBeDefined()
      expect(error.name).toBe('BaseError')
    })

    it('should have default values', () => {
      const error = new BaseError('Test message')
      
      expect(error.code).toBe('UNKNOWN_ERROR')
      expect(error.context).toEqual({})
      expect(error.cause).toBeNull()
    })

    it('should convert to JSON', () => {
      const error = new BaseError('Test message', 'TEST_CODE', { key: 'value' })
      const json = error.toJSON()
      
      expect(json.name).toBe('BaseError')
      expect(json.message).toBe('Test message')
      expect(json.code).toBe('TEST_CODE')
      expect(json.context).toEqual({ key: 'value' })
      expect(json.timestamp).toBeDefined()
    })

    it('should have correct default HTTP status', () => {
      const error = new BaseError('Test message')
      expect(error.getHttpStatusCode()).toBe(500)
    })

    it('should not be retryable by default', () => {
      const error = new BaseError('Test message')
      expect(error.isRetryable()).toBe(false)
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid input', 'username', 'test123', 'INVALID_FORMAT')
      
      expect(error.field).toBe('username')
      expect(error.value).toBe('test123')
      expect(error.code).toBe('INVALID_FORMAT')
      expect(error.getHttpStatusCode()).toBe(400)
    })

    it('should have user-friendly message', () => {
      const error = new ValidationError('Invalid input', 'username', 'test123')
      expect(error.getUserMessage()).toContain('Invalid input')
    })
  })

  describe('LLMApiError', () => {
    it('should create LLM API error with provider info', () => {
      const apiResponse = { error: 'Rate limit exceeded' }
      const error = new LLMApiError('API Error', 'anthropic', 429, apiResponse, 'RATE_LIMIT')
      
      expect(error.provider).toBe('anthropic')
      expect(error.statusCode).toBe(429)
      expect(error.apiResponse).toEqual(apiResponse)
      expect(error.code).toBe('RATE_LIMIT')
    })

    it('should be retryable for appropriate status codes', () => {
      const retryableCodes = [429, 500, 502, 503, 504]
      const nonRetryableCodes = [400, 401, 403, 404]
      
      retryableCodes.forEach(code => {
        const error = new LLMApiError('Error', 'anthropic', code)
        expect(error.isRetryable()).toBe(true)
      })
      
      nonRetryableCodes.forEach(code => {
        const error = new LLMApiError('Error', 'anthropic', code)
        expect(error.isRetryable()).toBe(false)
      })
    })

    it('should map status codes to HTTP responses', () => {
      const mappings = [
        [400, 400],
        [401, 500], // API key issue -> our config problem
        [429, 429],
        [500, 502], // Server error -> bad gateway
      ]
      
      mappings.forEach(([input, expected]) => {
        const error = new LLMApiError('Error', 'anthropic', input)
        expect(error.getHttpStatusCode()).toBe(expected)
      })
    })

    it('should have provider-specific user messages', () => {
      const error429 = new LLMApiError('Rate limited', 'anthropic', 429)
      expect(error429.getUserMessage()).toContain('temporarily busy')
      
      const error401 = new LLMApiError('Unauthorized', 'anthropic', 401)
      expect(error401.getUserMessage()).toContain('authentication failed')
    })
  })

  describe('DiscordApiError', () => {
    it('should create Discord API error', () => {
      const response = { message: 'Missing permissions' }
      const error = new DiscordApiError('Discord Error', 403, response, '/channels/123')
      
      expect(error.statusCode).toBe(403)
      expect(error.discordResponse).toEqual(response)
      expect(error.endpoint).toBe('/channels/123')
    })

    it('should be retryable for server errors and rate limits', () => {
      const retryableError = new DiscordApiError('Rate limited', 429)
      expect(retryableError.isRetryable()).toBe(true)
      
      const serverError = new DiscordApiError('Server error', 500)
      expect(serverError.isRetryable()).toBe(true)
      
      const clientError = new DiscordApiError('Bad request', 400)
      expect(clientError.isRetryable()).toBe(false)
    })

    it('should have Discord-specific user messages', () => {
      const error403 = new DiscordApiError('Forbidden', 403)
      expect(error403.getUserMessage()).toContain('lacks permission')
      
      const error404 = new DiscordApiError('Not found', 404)
      expect(error404.getUserMessage()).toContain('not found')
    })
  })

  describe('StorageError', () => {
    it('should create storage error with operation info', () => {
      const error = new StorageError('KV operation failed', 'get', 'user:123')
      
      expect(error.operation).toBe('get')
      expect(error.key).toBe('user:123')
      expect(error.isRetryable()).toBe(true)
    })
  })

  describe('TimeoutError', () => {
    it('should create timeout error with duration info', () => {
      const error = new TimeoutError('Operation timed out', 5000, 'api-call')
      
      expect(error.timeoutMs).toBe(5000)
      expect(error.operation).toBe('api-call')
      expect(error.isRetryable()).toBe(true)
      expect(error.getHttpStatusCode()).toBe(504)
    })
  })

  describe('ErrorFactory', () => {
    it('should create error from HTTP response for Discord', () => {
      const response = { status: 403 }
      const error = ErrorFactory.fromHttpResponse(response, 'discord', { endpoint: '/test' })
      
      expect(error).toBeInstanceOf(DiscordApiError)
      expect(error.statusCode).toBe(403)
    })

    it('should create error from HTTP response for LLM providers', () => {
      const response = { status: 429 }
      const error = ErrorFactory.fromHttpResponse(response, 'anthropic')
      
      expect(error).toBeInstanceOf(LLMApiError)
      expect(error.provider).toBe('anthropic')
      expect(error.statusCode).toBe(429)
    })

    it('should create generic error for unknown services', () => {
      const response = { status: 500 }
      const error = ErrorFactory.fromHttpResponse(response, 'unknown')
      
      expect(error).toBeInstanceOf(BaseError)
      expect(error.code).toBe('HTTP_ERROR')
    })

    it('should handle JavaScript errors', () => {
      const jsError = new TypeError('fetch failed')
      const error = ErrorFactory.fromError(jsError)
      
      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.operation).toBe('fetch')
    })

    it('should pass through existing BaseError instances', () => {
      const existingError = new ValidationError('Test', 'field', 'value')
      const error = ErrorFactory.fromError(existingError)
      
      expect(error).toBe(existingError)
    })
  })

  describe('ErrorHandler', () => {
    it('should convert error to HTTP response', () => {
      const error = new ValidationError('Invalid input', 'field', 'value')
      const response = ErrorHandler.toHttpResponse(error, 'trace-123')
      
      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should convert error to Discord response', () => {
      const error = new LLMApiError('API Error', 'anthropic', 429)
      const response = ErrorHandler.toDiscordResponse(error, true)
      
      expect(response.type).toBe(4) // CHANNEL_MESSAGE_WITH_SOURCE
      expect(response.data.flags).toBe(64) // Ephemeral
      expect(response.data.content).toContain('❌')
    })

    it('should determine retry logic correctly', () => {
      const retryableError = new LLMApiError('Error', 'anthropic', 429)
      expect(ErrorHandler.shouldRetry(retryableError, 0, 3)).toBe(true)
      expect(ErrorHandler.shouldRetry(retryableError, 3, 3)).toBe(false)
      
      const nonRetryableError = new ValidationError('Error', 'field', 'value')
      expect(ErrorHandler.shouldRetry(nonRetryableError, 0, 3)).toBe(false)
    })

    it('should calculate retry delay with exponential backoff', () => {
      const delay0 = ErrorHandler.getRetryDelay(0, 1000)
      const delay1 = ErrorHandler.getRetryDelay(1, 1000)
      const delay2 = ErrorHandler.getRetryDelay(2, 1000)
      
      expect(delay0).toBeGreaterThanOrEqual(1000)
      expect(delay1).toBeGreaterThanOrEqual(2000)
      expect(delay2).toBeGreaterThanOrEqual(4000)
      
      // Should cap at 30 seconds
      const delayLarge = ErrorHandler.getRetryDelay(10, 1000)
      expect(delayLarge).toBeLessThanOrEqual(30000)
    })
  })
})