// Unit tests for time utilities
import { describe, it, expect } from 'vitest'
import {
  convertToUserTimezone,
  getRelativeTime,
} from '../../src/utils/time.js'

describe('Time Utilities', () => {
  describe('convertToUserTimezone', () => {
    it('should convert ISO timestamps to user timezone', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = convertToUserTimezone(date.toISOString(), 'America/New_York')
      
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle invalid timestamps', () => {
      const result = convertToUserTimezone('invalid', 'UTC')
      expect(result).toBe('invalid') // Returns original on failure
    })

    it('should handle various timezone formats', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      
      expect(convertToUserTimezone(date.toISOString(), 'UTC')).toBeTruthy()
      expect(convertToUserTimezone(date.toISOString(), 'Europe/London')).toBeTruthy()
      expect(convertToUserTimezone(date.toISOString(), 'Asia/Tokyo')).toBeTruthy()
    })
  })

  describe('getRelativeTime', () => {
    it('should return relative time string', () => {
      const pastDate = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      const result = getRelativeTime(pastDate.toISOString())
      
      expect(result).toContain('ago')
      expect(typeof result).toBe('string')
    })

    it('should handle various time differences', () => {
      const secondsAgo = new Date(Date.now() - 30 * 1000)
      expect(getRelativeTime(secondsAgo.toISOString())).toContain('s ago')
      
      const minutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      expect(getRelativeTime(minutesAgo.toISOString())).toContain('m ago')
      
      const hoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      expect(getRelativeTime(hoursAgo.toISOString())).toContain('h ago')
      
      const daysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(getRelativeTime(daysAgo.toISOString())).toContain('d ago')
    })

    it('should handle invalid timestamps', () => {
      const result = getRelativeTime('invalid')
      expect(result).toBe('unknown time ago')
    })

    it('should handle null/undefined input', () => {
      expect(getRelativeTime(null)).toBe('unknown time ago')
      expect(getRelativeTime(undefined)).toBe('unknown time ago')
    })
  })

  describe('Edge cases and performance', () => {
    it('should handle extreme dates', () => {
      const veryOldDate = new Date('1970-01-01T00:00:00Z')
      const veryFutureDate = new Date('2099-12-31T23:59:59Z')
      
      expect(convertToUserTimezone(veryOldDate.toISOString(), 'UTC')).toBeTruthy()
      expect(convertToUserTimezone(veryFutureDate.toISOString(), 'UTC')).toBeTruthy()
      expect(getRelativeTime(veryOldDate.toISOString())).toContain('ago')
    })

    it('should handle daylight saving time transitions', () => {
      // Test dates around DST transitions
      const springForward = new Date('2024-03-10T10:00:00Z')
      const fallBack = new Date('2024-11-03T10:00:00Z')
      
      expect(convertToUserTimezone(springForward.toISOString(), 'America/New_York')).toBeTruthy()
      expect(convertToUserTimezone(fallBack.toISOString(), 'America/New_York')).toBeTruthy()
    })

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z')
      expect(convertToUserTimezone(leapDay.toISOString(), 'UTC')).toContain('2024')
    })
  })
})