// Unit tests for validation utilities
import { describe, it, expect, beforeEach } from 'vitest'
import { InputValidator } from '../../src/utils/validation.js'
import { ValidationError } from '../../src/utils/errors.js'

describe('Validation Utilities', () => {
  let validator

  beforeEach(() => {
    validator = new InputValidator()
  })

  describe('validateUserId', () => {
    it('should validate correct Discord user ID', () => {
      const validId = '123456789012345678'
      expect(validator.validateUserId(validId)).toBe(validId)
    })

    it('should reject empty user ID', () => {
      expect(() => validator.validateUserId('')).toThrow(ValidationError)
      expect(() => validator.validateUserId(null)).toThrow(ValidationError)
      expect(() => validator.validateUserId(undefined)).toThrow(ValidationError)
    })

    it('should reject non-string user ID', () => {
      expect(() => validator.validateUserId(123)).toThrow(ValidationError)
      expect(() => validator.validateUserId({})).toThrow(ValidationError)
      expect(() => validator.validateUserId([])).toThrow(ValidationError)
    })

    it('should reject invalid format user ID', () => {
      expect(() => validator.validateUserId('123')).toThrow(ValidationError) // Too short
      expect(() => validator.validateUserId('12345678901234567890')).toThrow(ValidationError) // Too long
      expect(() => validator.validateUserId('12345678901234567a')).toThrow(ValidationError) // Non-numeric
    })

    it('should accept edge case valid IDs', () => {
      const minValidId = '12345678901234567' // 17 digits
      const maxValidId = '1234567890123456789' // 19 digits
      
      expect(validator.validateUserId(minValidId)).toBe(minValidId)
      expect(validator.validateUserId(maxValidId)).toBe(maxValidId)
    })
  })

  describe('validateChannelId', () => {
    it('should validate correct Discord channel ID', () => {
      const validId = '123456789012345678'
      expect(validator.validateChannelId(validId)).toBe(validId)
    })

    it('should reject invalid channel ID formats', () => {
      expect(() => validator.validateChannelId('123')).toThrow(ValidationError)
      expect(() => validator.validateChannelId('invalid')).toThrow(ValidationError)
      expect(() => validator.validateChannelId('')).toThrow(ValidationError)
      expect(() => validator.validateChannelId(null)).toThrow(ValidationError)
    })
  })

  describe('validateStatusText', () => {
    it('should validate normal status text', () => {
      const validText = 'Working on a project'
      expect(validator.validateStatusText(validText)).toBe(validText)
    })

    it('should reject empty status text', () => {
      expect(() => validator.validateStatusText('')).toThrow(ValidationError)
      expect(() => validator.validateStatusText('   ')).toThrow(ValidationError) // Only whitespace
      expect(() => validator.validateStatusText(null)).toThrow(ValidationError)
    })

    it('should reject status text that exceeds max length', () => {
      const longText = 'a'.repeat(2001)
      expect(() => validator.validateStatusText(longText)).toThrow(ValidationError)
    })

    it('should allow custom max length', () => {
      const text = 'a'.repeat(100)
      expect(() => validator.validateStatusText(text, 50)).toThrow(ValidationError)
      expect(validator.validateStatusText(text, 150)).toBe(text)
    })

    it('should detect XSS patterns', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<iframe src="malicious.com"></iframe>',
        '<img onerror="alert(1)" src="x">',
      ]

      xssPayloads.forEach(payload => {
        expect(() => validator.validateStatusText(payload)).toThrow(ValidationError)
      })
    })

    it('should detect SQL injection patterns', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        'UNION SELECT * FROM passwords',
        "admin'--",
      ]

      sqlPayloads.forEach(payload => {
        expect(() => validator.validateStatusText(payload)).toThrow(ValidationError)
      })
    })

    it('should allow safe special characters', () => {
      const safeText = 'Working on project #1 (50% done) & feeling good! 😀'
      expect(validator.validateStatusText(safeText)).toBe(safeText)
    })

    it('should handle unicode characters', () => {
      const unicodeText = '日本語のテスト文字列です 🎌'
      expect(validator.validateStatusText(unicodeText)).toBe(unicodeText)
    })
  })

  describe('validateEmoji', () => {
    it('should validate standard emojis', () => {
      const validEmojis = ['😀', '🎉', '❤️', '🔥', '⭐']
      
      validEmojis.forEach(emoji => {
        expect(validator.validateEmoji(emoji)).toBe(emoji)
      })
    })

    it('should validate custom Discord emoji format', () => {
      const customEmoji = '<:custom_emoji:123456789012345678>'
      expect(validator.validateEmoji(customEmoji)).toBe(customEmoji)
    })

    it('should reject invalid emoji formats', () => {
      const invalidEmojis = [
        '<:invalid>',
        '<:emoji:not_a_number>',
        'not_an_emoji',
        '',
        null,
      ]

      invalidEmojis.forEach(emoji => {
        expect(() => validator.validateEmoji(emoji)).toThrow(ValidationError)
      })
    })

    it('should handle emoji sequences', () => {
      const emojiSequence = '👨‍💻' // Man technologist with ZWJ
      expect(validator.validateEmoji(emojiSequence)).toBe(emojiSequence)
    })
  })

  describe('validateTimezone', () => {
    it('should validate IANA timezone identifiers', () => {
      const validTimezones = [
        'America/New_York',
        'Europe/London', 
        'Asia/Tokyo',
        'UTC',
      ]

      validTimezones.forEach(timezone => {
        expect(validator.validateTimezone(timezone)).toBe(timezone)
      })
    })

    it('should reject invalid timezone formats', () => {
      const invalidTimezones = [
        'EST', // Not IANA format
        'Invalid/Timezone',
        '',
        null,
      ]

      invalidTimezones.forEach(timezone => {
        expect(() => validator.validateTimezone(timezone)).toThrow()
      })
    })
  })

  describe('InputValidator class', () => {
    it('should initialize with default logger', () => {
      const v = new InputValidator()
      expect(v.logger).toBeDefined()
    })

    it('should initialize with custom logger', () => {
      const customLogger = { warn: () => {}, info: () => {} }
      const v = new InputValidator(customLogger)
      expect(v.logger).toBe(customLogger)
    })

    it('should handle validation errors consistently', () => {
      try {
        validator.validateUserId('invalid')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.field).toBe('userId')
        expect(error.code).toBe('INVALID_FORMAT')
      }
    })
  })

  describe('ValidationError', () => {
    it('should create error with proper properties', () => {
      const error = new ValidationError('Test message', 'field', 'value', 'CODE')
      
      expect(error.message).toBe('Test message')
      expect(error.field).toBe('field')
      expect(error.value).toBe('value')
      expect(error.code).toBe('CODE')
      expect(error.name).toBe('ValidationError')
    })

    it('should have correct HTTP status code', () => {
      const error = new ValidationError('Test message')
      expect(error.getHttpStatusCode()).toBe(400)
    })

    it('should have user-friendly message', () => {
      const error = new ValidationError('Field is invalid', 'username', 'test')
      const userMessage = error.getUserMessage()
      
      expect(userMessage).toContain('Field is invalid')
      expect(userMessage).toBeTruthy()
    })
  })
})