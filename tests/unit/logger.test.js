// Unit tests for structured logging system
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  Logger, 
  createLogger, 
  createRequestLogger,
  generateTraceId,
} from '../../src/utils/logger.js'

describe('Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateTraceId', () => {
    it('should generate valid trace ID format', () => {
      const traceId = generateTraceId()
      
      expect(traceId).toMatch(/^[0-9a-f]{24}$/) // 24 hex characters
      expect(traceId).toHaveLength(24)
    })

    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId()
      const id2 = generateTraceId()
      
      expect(id1).not.toBe(id2)
    })
  })

  describe('Logger class', () => {
    let logger

    beforeEach(() => {
      logger = new Logger({ component: 'test' })
    })

    it('should initialize with context and trace ID', () => {
      expect(logger.context.component).toBe('test')
      expect(logger.traceId).toBeDefined()
      expect(logger.traceId).toMatch(/^[0-9a-f]{24}$/)
    })

    it('should use provided trace ID', () => {
      const customTraceId = '507f1f77bcf86cd799439011'
      const loggerWithId = new Logger({ component: 'test' }, customTraceId)
      
      expect(loggerWithId.traceId).toBe(customTraceId)
    })

    it('should get trace ID', () => {
      const traceId = logger.getTraceId()
      expect(traceId).toBe(logger.traceId)
    })

    it('should format log messages with metadata', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      logger.info('Test message', { key: 'value' })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `[${logger.traceId}] [test] Test message`,
        expect.objectContaining({
          component: 'test',
          key: 'value',
          timestamp: expect.any(String),
          level: 'info',
          traceId: logger.traceId,
        }),
      )
      
      consoleSpy.mockRestore()
    })

    it('should log at different levels', () => {
      const levels = ['debug', 'info', 'warn', 'error']
      
      levels.forEach(level => {
        const spy = vi.spyOn(console, level).mockImplementation(() => {})
        
        logger[level]('Test message')
        
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('Test message'),
          expect.objectContaining({ level }),
        )
        
        spy.mockRestore()
      })
    })

    it('should handle errors in error logging', () => {
      const error = new Error('Test error')
      error.stack = 'Error stack trace'
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      logger.error('Error occurred', { error })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            name: 'Error',
            stack: 'Error stack trace',
          }),
        }),
      )
      
      consoleSpy.mockRestore()
    })

    it('should merge context data properly', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      logger.info('Test message', { 
        existingKey: 'new value',
        newKey: 'value',
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          component: 'test', // Original context
          existingKey: 'new value', // Overridden
          newKey: 'value', // New data
        }),
      )
      
      consoleSpy.mockRestore()
    })

    it('should include timestamp in correct format', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      logger.info('Test message')
      
      const logCall = consoleSpy.mock.calls[0]
      const metadata = logCall[1]
      
      expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      
      consoleSpy.mockRestore()
    })
  })

  describe('createLogger factory', () => {
    it('should create logger with component name', () => {
      const logger = createLogger('api-handler')
      
      expect(logger).toBeInstanceOf(Logger)
      expect(logger.context.component).toBe('api-handler')
    })

    it('should create logger with additional context', () => {
      const logger = createLogger('api-handler', { userId: '123', action: 'update' })
      
      expect(logger.context.component).toBe('api-handler')
      expect(logger.context.userId).toBe('123')
      expect(logger.context.action).toBe('update')
    })

    it('should create logger with custom trace ID', () => {
      const customTraceId = '507f1f77bcf86cd799439011'
      const logger = createLogger('api-handler', {}, customTraceId)
      
      expect(logger.traceId).toBe(customTraceId)
    })
  })

  describe('createRequestLogger factory', () => {
    it('should create request logger with user and component', () => {
      const logger = createRequestLogger('user123', 'status-processor')
      
      expect(logger).toBeInstanceOf(Logger)
      expect(logger.context.component).toBe('status-processor')
      expect(logger.context.userId).toBe('user123')
    })

    it('should create request logger with additional context', () => {
      const logger = createRequestLogger('user123', 'status-processor', {
        statusLength: 100,
        channel: 'test-channel',
      })
      
      expect(logger.context.userId).toBe('user123')
      expect(logger.context.component).toBe('status-processor')
      expect(logger.context.statusLength).toBe(100)
      expect(logger.context.channel).toBe('test-channel')
    })

    it('should generate unique trace ID for each request', () => {
      const logger1 = createRequestLogger('user123', 'component1')
      const logger2 = createRequestLogger('user456', 'component2')
      
      expect(logger1.traceId).not.toBe(logger2.traceId)
    })
  })

  describe('Trace ID format validation', () => {
    it('should generate MongoDB ObjectId-style trace IDs', () => {
      const traceIds = Array.from({ length: 100 }, () => generateTraceId())
      
      traceIds.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{24}$/)
        expect(id).toHaveLength(24)
      })
      
      // Check uniqueness
      const uniqueIds = new Set(traceIds)
      expect(uniqueIds.size).toBe(100)
    })

    it('should handle edge cases in trace ID generation', () => {
      // Mock crypto.getRandomValues to test edge cases
      const originalGetRandomValues = global.crypto.getRandomValues
      
      // Test with all zeros
      global.crypto.getRandomValues = vi.fn((arr) => {
        arr.fill(0)
        return arr
      })
      
      const zeroId = generateTraceId()
      expect(zeroId).toBe('000000000000000000000000')
      
      // Test with all 255s
      global.crypto.getRandomValues = vi.fn((arr) => {
        arr.fill(255)
        return arr
      })
      
      const maxId = generateTraceId()
      expect(maxId).toBe('ffffffffffffffffffffffff')
      
      // Restore original function
      global.crypto.getRandomValues = originalGetRandomValues
    })
  })

  describe('Performance and memory', () => {
    it('should not leak memory with many trace IDs', () => {
      const initialMemory = process.memoryUsage?.() || { heapUsed: 0 }
      
      // Generate many trace IDs
      for (let i = 0; i < 10000; i++) {
        generateTraceId()
      }
      
      const afterMemory = process.memoryUsage?.() || { heapUsed: 0 }
      
      // Memory increase should be reasonable (less than 10MB)
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it('should generate trace IDs quickly', () => {
      const start = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        generateTraceId()
      }
      
      const duration = Date.now() - start
      
      // Should generate 1000 IDs in less than 100ms
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Integration with error objects', () => {
    it('should properly serialize error objects', () => {
      const logger = createLogger('test')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const error = new Error('Test error')
      error.code = 'TEST_ERROR'
      error.statusCode = 500
      
      logger.error('Error occurred', { error })
      
      const logCall = consoleSpy.mock.calls[0]
      const metadata = logCall[1]
      
      expect(metadata.error).toEqual({
        message: 'Test error',
        name: 'Error',
        code: 'TEST_ERROR',
        statusCode: 500,
        stack: expect.any(String),
      })
      
      consoleSpy.mockRestore()
    })

    it('should handle circular references in error objects', () => {
      const logger = createLogger('test')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const error = new Error('Test error')
      error.self = error // Create circular reference
      
      expect(() => {
        logger.error('Error with circular reference', { error })
      }).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })
})