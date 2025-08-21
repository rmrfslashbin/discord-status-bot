// Unit tests for context relevance and filtering
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateContextRelevance,
  filterRelevantContext,
  updatePersonalStateTimes,
} from '../../src/llm/context.js'

describe('Context Management', () => {
  let sampleStatus

  beforeEach(() => {
    sampleStatus = {
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      raw_input: 'Working on the project, feeling energetic and focused',
      processed_status: {
        metrics: [
          {
            name: 'Energy',
            value: 'High',
            value_rating: 4,
            trend: 'improved',
            icon: '⚡',
          },
          {
            name: 'Focus',
            value: 'Strong',
            value_rating: 4,
            trend: 'stable',
            icon: '🎯',
          },
        ],
        highlights: [
          {
            type: 'activity',
            description: 'Working on project',
            timeframe: 'current',
            is_new: true,
          },
          {
            type: 'state',
            description: 'Feeling energetic',
            timeframe: 'current',
            is_new: false,
          },
        ],
        persistent_context: [
          {
            description: 'Long-term project work',
            from_previous: false,
            source_timestamp: null,
          },
        ],
      },
    }
  })

  describe('calculateContextRelevance', () => {
    it('should calculate relevance scores for all elements', () => {
      const result = calculateContextRelevance(sampleStatus)
      
      expect(result).toBeDefined()
      expect(result.processed_status.metrics).toHaveLength(2)
      expect(result.processed_status.highlights).toHaveLength(2)
      expect(result.processed_status.persistent_context).toHaveLength(1)
      
      // Check that relevance scores were added
      result.processed_status.metrics.forEach(metric => {
        expect(metric.relevance_score).toBeDefined()
        expect(metric.relevance_score).toBeGreaterThanOrEqual(0)
        expect(metric.relevance_score).toBeLessThanOrEqual(1)
      })
      
      result.processed_status.highlights.forEach(highlight => {
        expect(highlight.relevance_score).toBeDefined()
        expect(highlight.relevance_score).toBeGreaterThanOrEqual(0)
        expect(highlight.relevance_score).toBeLessThanOrEqual(1)
      })
      
      result.processed_status.persistent_context.forEach(context => {
        expect(context.relevance_score).toBeDefined()
        expect(context.relevance_score).toBeGreaterThanOrEqual(0)
        expect(context.relevance_score).toBeLessThanOrEqual(1)
      })
    })

    it('should return null for invalid input', () => {
      expect(calculateContextRelevance(null)).toBeNull()
      expect(calculateContextRelevance({})).toBeNull()
      expect(calculateContextRelevance({ timestamp: 'invalid' })).toBe({
        timestamp: 'invalid',
      })
    })

    it('should decay relevance based on time', () => {
      // Recent status (1 hour ago)
      const recentStatus = {
        ...sampleStatus,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      }
      
      // Old status (25 hours ago)
      const oldStatus = {
        ...sampleStatus,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      }
      
      const recentResult = calculateContextRelevance(recentStatus)
      const oldResult = calculateContextRelevance(oldStatus)
      
      // Recent metrics should have higher relevance than old ones
      const recentPhysicalScore = recentResult.processed_status.metrics[0].relevance_score
      const oldPhysicalScore = oldResult.processed_status.metrics[0].relevance_score
      
      expect(recentPhysicalScore).toBeGreaterThan(oldPhysicalScore)
    })

    it('should categorize metrics correctly', () => {
      const statusWithDifferentMetrics = {
        ...sampleStatus,
        processed_status: {
          ...sampleStatus.processed_status,
          metrics: [
            { name: 'Energy', value: 'High' }, // Physical
            { name: 'Mood', value: 'Good' }, // Emotional
            { name: 'Project Progress', value: '75%' }, // Activity
            { name: 'Unknown Metric', value: 'Value' }, // Default
          ],
        },
      }
      
      const result = calculateContextRelevance(statusWithDifferentMetrics)
      
      // All metrics should have relevance scores
      result.processed_status.metrics.forEach(metric => {
        expect(metric.relevance_score).toBeDefined()
        expect(typeof metric.relevance_score).toBe('number')
      })
    })

    it('should handle missing processed_status gracefully', () => {
      const invalidStatus = {
        timestamp: new Date().toISOString(),
        raw_input: 'Test',
        // Missing processed_status
      }
      
      expect(() => calculateContextRelevance(invalidStatus)).not.toThrow()
    })
  })

  describe('filterRelevantContext', () => {
    let contextWithRelevance

    beforeEach(() => {
      contextWithRelevance = calculateContextRelevance(sampleStatus)
      // Manually set some relevance scores for testing
      contextWithRelevance.processed_status.metrics[0].relevance_score = 0.8
      contextWithRelevance.processed_status.metrics[1].relevance_score = 0.2
      contextWithRelevance.processed_status.highlights[0].relevance_score = 0.9
      contextWithRelevance.processed_status.highlights[1].relevance_score = 0.1
      contextWithRelevance.processed_status.persistent_context[0].relevance_score = 0.7
    })

    it('should filter elements below threshold', () => {
      const result = filterRelevantContext(contextWithRelevance, 0.3)
      
      expect(result.processed_status.metrics).toHaveLength(1) // Only one above 0.3
      expect(result.processed_status.highlights).toHaveLength(1) // Only one above 0.3
      expect(result.processed_status.persistent_context).toHaveLength(1) // One above 0.3
      
      expect(result.processed_status.metrics[0].relevance_score).toBe(0.8)
      expect(result.processed_status.highlights[0].relevance_score).toBe(0.9)
      expect(result.processed_status.persistent_context[0].relevance_score).toBe(0.7)
    })

    it('should use default threshold of 0.3', () => {
      const result = filterRelevantContext(contextWithRelevance)
      
      // Should filter out items with relevance < 0.3
      expect(result.processed_status.metrics).toHaveLength(1)
      expect(result.processed_status.highlights).toHaveLength(1)
    })

    it('should handle invalid threshold values', () => {
      const result = filterRelevantContext(contextWithRelevance, -1)
      
      // Should use default threshold of 0.3
      expect(result.processed_status.metrics).toHaveLength(1)
    })

    it('should return null for invalid input', () => {
      expect(filterRelevantContext(null)).toBeNull()
      expect(filterRelevantContext({})).toBeNull()
    })

    it('should preserve original structure', () => {
      const result = filterRelevantContext(contextWithRelevance, 0.3)
      
      expect(result.timestamp).toBe(contextWithRelevance.timestamp)
      expect(result.raw_input).toBe(contextWithRelevance.raw_input)
      expect(result.processed_status).toBeDefined()
    })
  })

  describe('updatePersonalStateTimes', () => {
    let previousStates, currentStates, previousTimestamp

    beforeEach(() => {
      previousStates = [
        {
          name: 'energy',
          emoji: '⚡',
          level: 3,
          time_since_last: '2h',
          trend: 'stable',
        },
        {
          name: 'hunger',
          emoji: '🍽️',
          level: 4,
          time_since_last: '1h',
          trend: 'increasing',
        },
      ]
      
      currentStates = [
        {
          name: 'energy',
          emoji: '⚡',
          level: 4, // Increased
          trend: 'new', // Will be updated
        },
        {
          name: 'focus',
          emoji: '🎯',
          level: 5,
          trend: 'new', // Truly new state
        },
      ]
      
      previousTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
    })

    it('should update trends for existing states', () => {
      const result = updatePersonalStateTimes(previousStates, currentStates, previousTimestamp)
      
      const energyState = result.find(state => state.name === 'energy')
      expect(energyState.trend).toBe('increasing') // Level went from 3 to 4
      
      const focusState = result.find(state => state.name === 'focus')
      expect(focusState.trend).toBe('new') // New state
    })

    it('should detect different trend types', () => {
      const testCases = [
        { prev: 3, curr: 4, expected: 'increasing' },
        { prev: 4, curr: 3, expected: 'decreasing' },
        { prev: 3, curr: 3, expected: 'stable' },
      ]
      
      testCases.forEach(({ prev, curr, expected }) => {
        const prevStates = [{ name: 'test', level: prev }]
        const currStates = [{ name: 'test', level: curr }]
        
        const result = updatePersonalStateTimes(prevStates, currStates, previousTimestamp)
        expect(result[0].trend).toBe(expected)
      })
    })

    it('should handle missing previous states', () => {
      const result = updatePersonalStateTimes([], currentStates, previousTimestamp)
      
      result.forEach(state => {
        expect(state.trend).toBe('new')
      })
    })

    it('should handle invalid inputs gracefully', () => {
      expect(() => updatePersonalStateTimes(null, currentStates, previousTimestamp)).not.toThrow()
      expect(() => updatePersonalStateTimes(previousStates, null, previousTimestamp)).not.toThrow()
      expect(() => updatePersonalStateTimes(previousStates, currentStates, null)).not.toThrow()
    })

    it('should preserve state properties', () => {
      const result = updatePersonalStateTimes(previousStates, currentStates, previousTimestamp)
      
      const energyState = result.find(state => state.name === 'energy')
      expect(energyState.emoji).toBe('⚡')
      expect(energyState.level).toBe(4)
      expect(energyState.name).toBe('energy')
    })

    it('should handle states with non-numeric levels', () => {
      const invalidCurrentStates = [
        {
          name: 'energy',
          level: 'high', // Non-numeric
        },
      ]
      
      expect(() => updatePersonalStateTimes(previousStates, invalidCurrentStates, previousTimestamp)).not.toThrow()
    })
  })
})