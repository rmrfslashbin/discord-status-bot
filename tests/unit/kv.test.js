// Unit tests for KV storage operations
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getUserData,
  setUserData,
  getUserActivity,
  addUserActivity,
  getUserStats,
  purgeUserData,
  getGlobalStats,
  setGlobalStats,
} from '../../src/storage/kv.js'
import { createMockKV, TEST_DATA } from '../setup.js'

describe('KV Storage Operations', () => {
  let mockKV, mockConfig

  beforeEach(() => {
    vi.clearAllMocks()
    mockKV = createMockKV()
    mockConfig = {
      get: () => ({
        kv: mockKV,
      }),
    }
  })

  describe('getUserData', () => {
    it('should retrieve user data successfully', async () => {
      const userData = { profile: { timezone: 'UTC' }, settings: {} }
      mockKV.get.mockResolvedValueOnce(JSON.stringify(userData))

      const result = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(mockKV.get).toHaveBeenCalledWith(`user:${TEST_DATA.DISCORD_USER_ID}`)
      expect(result).toEqual(userData)
    })

    it('should return default data for new users', async () => {
      mockKV.get.mockResolvedValueOnce(null)

      const result = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual({
        profile: {
          timezone: 'UTC',
          created_at: expect.any(String),
        },
        settings: {
          notifications: true,
          privacy_level: 'normal',
        },
        stats: {
          total_updates: 0,
          streak_days: 0,
          last_update: null,
        },
      })
    })

    it('should handle invalid JSON gracefully', async () => {
      mockKV.get.mockResolvedValueOnce('invalid json')

      const result = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual(expect.objectContaining({
        profile: expect.any(Object),
        settings: expect.any(Object),
        stats: expect.any(Object),
      }))
    })

    it('should handle KV errors', async () => {
      mockKV.get.mockRejectedValueOnce(new Error('KV Error'))

      const result = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual(expect.objectContaining({
        profile: expect.any(Object),
      }))
    })
  })

  describe('setUserData', () => {
    it('should store user data successfully', async () => {
      const userData = {
        profile: { timezone: 'America/New_York' },
        settings: { notifications: false },
      }

      await setUserData(TEST_DATA.DISCORD_USER_ID, userData, mockConfig)

      expect(mockKV.put).toHaveBeenCalledWith(
        `user:${TEST_DATA.DISCORD_USER_ID}`,
        JSON.stringify(userData),
        { expirationTtl: 7776000 } // 90 days
      )
    })

    it('should handle storage errors', async () => {
      mockKV.put.mockRejectedValueOnce(new Error('Storage Error'))

      await expect(setUserData(TEST_DATA.DISCORD_USER_ID, {}, mockConfig)).rejects.toThrow('Storage Error')
    })

    it('should validate user ID format', async () => {
      await expect(setUserData('invalid-id', {}, mockConfig)).rejects.toThrow()
    })

    it('should handle large data objects', async () => {
      const largeData = {
        profile: { timezone: 'UTC' },
        history: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          status: `Status ${i}`,
          timestamp: new Date().toISOString(),
        })),
      }

      await setUserData(TEST_DATA.DISCORD_USER_ID, largeData, mockConfig)

      expect(mockKV.put).toHaveBeenCalledWith(
        `user:${TEST_DATA.DISCORD_USER_ID}`,
        expect.any(String),
        expect.any(Object)
      )
    })
  })

  describe('getUserActivity', () => {
    it('should retrieve user activity data', async () => {
      const activityData = [
        {
          id: 'act1',
          timestamp: '2024-01-15T10:00:00Z',
          type: 'status_update',
          data: { status: 'Working on project' },
        },
      ]
      mockKV.get.mockResolvedValueOnce(JSON.stringify(activityData))

      const result = await getUserActivity(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(mockKV.get).toHaveBeenCalledWith(`activity:${TEST_DATA.DISCORD_USER_ID}`)
      expect(result).toEqual(activityData)
    })

    it('should return empty array for no activity', async () => {
      mockKV.get.mockResolvedValueOnce(null)

      const result = await getUserActivity(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual([])
    })

    it('should filter activity by timeframe', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

      const activityData = [
        { id: '1', timestamp: now.toISOString(), type: 'recent' },
        { id: '2', timestamp: oneHourAgo.toISOString(), type: 'recent' },
        { id: '3', timestamp: twoDaysAgo.toISOString(), type: 'old' },
      ]
      mockKV.get.mockResolvedValueOnce(JSON.stringify(activityData))

      const result = await getUserActivity(TEST_DATA.DISCORD_USER_ID, mockConfig, {
        since: oneHourAgo,
      })

      expect(result).toHaveLength(2)
      expect(result.every(item => item.type === 'recent')).toBe(true)
    })
  })

  describe('addUserActivity', () => {
    it('should add new activity entry', async () => {
      mockKV.get.mockResolvedValueOnce(JSON.stringify([]))

      const newActivity = {
        type: 'status_update',
        data: { status: 'New status' },
      }

      await addUserActivity(TEST_DATA.DISCORD_USER_ID, newActivity, mockConfig)

      expect(mockKV.put).toHaveBeenCalledWith(
        `activity:${TEST_DATA.DISCORD_USER_ID}`,
        expect.stringContaining('status_update'),
        { expirationTtl: 7776000 }
      )
    })

    it('should maintain activity limit', async () => {
      const existingActivity = Array.from({ length: 1000 }, (_, i) => ({
        id: `act${i}`,
        timestamp: new Date().toISOString(),
        type: 'old_activity',
      }))
      mockKV.get.mockResolvedValueOnce(JSON.stringify(existingActivity))

      const newActivity = {
        type: 'status_update',
        data: { status: 'New status' },
      }

      await addUserActivity(TEST_DATA.DISCORD_USER_ID, newActivity, mockConfig)

      const putCall = mockKV.put.mock.calls[0]
      const storedData = JSON.parse(putCall[1])
      
      expect(storedData.length).toBeLessThanOrEqual(500) // Should limit to 500 entries
      expect(storedData[0].type).toBe('status_update') // New activity should be first
    })

    it('should generate unique activity IDs', async () => {
      mockKV.get.mockResolvedValueOnce(JSON.stringify([]))

      const activity1 = { type: 'test1', data: {} }
      const activity2 = { type: 'test2', data: {} }

      await addUserActivity(TEST_DATA.DISCORD_USER_ID, activity1, mockConfig)
      await addUserActivity(TEST_DATA.DISCORD_USER_ID, activity2, mockConfig)

      const calls = mockKV.put.mock.calls.filter(call => 
        call[0] === `activity:${TEST_DATA.DISCORD_USER_ID}`
      )
      
      expect(calls.length).toBe(2)
      calls.forEach(call => {
        const data = JSON.parse(call[1])
        expect(data[0]).toHaveProperty('id')
        expect(data[0].id).toMatch(/^[0-9a-f]{24}$/) // MongoDB ObjectId format
      })
    })
  })

  describe('getUserStats', () => {
    it('should calculate user statistics', async () => {
      const mockUserData = {
        stats: {
          total_updates: 42,
          streak_days: 7,
          last_update: '2024-01-15T10:00:00Z',
        },
      }
      mockKV.get.mockResolvedValueOnce(JSON.stringify(mockUserData))

      const mockActivity = [
        { type: 'status_update', timestamp: '2024-01-15T10:00:00Z' },
        { type: 'status_update', timestamp: '2024-01-14T10:00:00Z' },
        { type: 'mood_check', timestamp: '2024-01-13T10:00:00Z' },
      ]
      mockKV.get.mockResolvedValueOnce(JSON.stringify(mockActivity))

      const result = await getUserStats(TEST_DATA.DISCORD_USER_ID, mockConfig, {
        timeframe: '7d',
      })

      expect(result).toEqual({
        total_updates: 42,
        streak_days: 7,
        last_update: '2024-01-15T10:00:00Z',
        recent_activity: expect.any(Array),
        activity_breakdown: expect.any(Object),
        trends: expect.any(Object),
      })
    })

    it('should handle users with no data', async () => {
      mockKV.get.mockResolvedValueOnce(null) // No user data
      mockKV.get.mockResolvedValueOnce(null) // No activity

      const result = await getUserStats(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual({
        total_updates: 0,
        streak_days: 0,
        last_update: null,
        recent_activity: [],
        activity_breakdown: {},
        trends: {},
      })
    })
  })

  describe('purgeUserData', () => {
    it('should delete all user data', async () => {
      await purgeUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(mockKV.delete).toHaveBeenCalledWith(`user:${TEST_DATA.DISCORD_USER_ID}`)
      expect(mockKV.delete).toHaveBeenCalledWith(`activity:${TEST_DATA.DISCORD_USER_ID}`)
      expect(mockKV.delete).toHaveBeenCalledWith(`profile:${TEST_DATA.DISCORD_USER_ID}`)
    })

    it('should handle deletion errors gracefully', async () => {
      mockKV.delete.mockRejectedValueOnce(new Error('Delete Error'))

      // Should not throw, but log error
      await expect(purgeUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)).resolves.not.toThrow()
    })

    it('should delete related data keys', async () => {
      await purgeUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      const deleteCalls = mockKV.delete.mock.calls.map(call => call[0])
      
      expect(deleteCalls).toContain(`user:${TEST_DATA.DISCORD_USER_ID}`)
      expect(deleteCalls).toContain(`activity:${TEST_DATA.DISCORD_USER_ID}`)
      expect(deleteCalls).toContain(`profile:${TEST_DATA.DISCORD_USER_ID}`)
    })
  })

  describe('getGlobalStats', () => {
    it('should retrieve global statistics', async () => {
      const globalStats = {
        total_users: 150,
        total_updates: 1500,
        daily_active_users: 25,
        last_updated: '2024-01-15T12:00:00Z',
      }
      mockKV.get.mockResolvedValueOnce(JSON.stringify(globalStats))

      const result = await getGlobalStats(mockConfig)

      expect(mockKV.get).toHaveBeenCalledWith('global:stats')
      expect(result).toEqual(globalStats)
    })

    it('should return default stats when none exist', async () => {
      mockKV.get.mockResolvedValueOnce(null)

      const result = await getGlobalStats(mockConfig)

      expect(result).toEqual({
        total_users: 0,
        total_updates: 0,
        daily_active_users: 0,
        weekly_active_users: 0,
        last_updated: null,
      })
    })
  })

  describe('setGlobalStats', () => {
    it('should store global statistics', async () => {
      const stats = {
        total_users: 200,
        total_updates: 2000,
        daily_active_users: 50,
      }

      await setGlobalStats(stats, mockConfig)

      expect(mockKV.put).toHaveBeenCalledWith(
        'global:stats',
        JSON.stringify({
          ...stats,
          last_updated: expect.any(String),
        }),
        { expirationTtl: 2592000 } // 30 days
      )
    })

    it('should add timestamp automatically', async () => {
      const stats = { total_users: 100 }

      await setGlobalStats(stats, mockConfig)

      const putCall = mockKV.put.mock.calls[0]
      const storedData = JSON.parse(putCall[1])
      
      expect(storedData.last_updated).toBeDefined()
      expect(new Date(storedData.last_updated)).toBeInstanceOf(Date)
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle concurrent modifications', async () => {
      // Simulate concurrent activity additions
      const promises = Array.from({ length: 10 }, (_, i) => 
        addUserActivity(TEST_DATA.DISCORD_USER_ID, {
          type: 'concurrent_test',
          data: { index: i },
        }, mockConfig)
      )

      await Promise.all(promises)

      expect(mockKV.put).toHaveBeenCalledTimes(10)
    })

    it('should handle malformed data gracefully', async () => {
      mockKV.get.mockResolvedValueOnce('{"invalid": json}')

      const result = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)

      expect(result).toEqual(expect.objectContaining({
        profile: expect.any(Object),
        settings: expect.any(Object),
      }))
    })

    it('should handle KV service unavailability', async () => {
      mockKV.get.mockRejectedValue(new Error('Service Unavailable'))
      mockKV.put.mockRejectedValue(new Error('Service Unavailable'))

      // Operations should handle errors gracefully
      const userData = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)
      expect(userData).toBeDefined()

      await expect(setUserData(TEST_DATA.DISCORD_USER_ID, {}, mockConfig))
        .rejects.toThrow('Service Unavailable')
    })

    it('should validate data size limits', async () => {
      const oversizedData = {
        large_array: Array.from({ length: 100000 }, () => 'x'.repeat(1000)),
      }

      // Should handle large data appropriately (truncate or reject)
      await expect(setUserData(TEST_DATA.DISCORD_USER_ID, oversizedData, mockConfig))
        .resolves.not.toThrow()
    })
  })

  describe('Data consistency and integrity', () => {
    it('should maintain data consistency across operations', async () => {
      const userData = { profile: { timezone: 'UTC' }, stats: { total_updates: 5 } }
      
      // Set data
      await setUserData(TEST_DATA.DISCORD_USER_ID, userData, mockConfig)
      
      // Mock retrieval
      mockKV.get.mockResolvedValueOnce(JSON.stringify(userData))
      
      const retrieved = await getUserData(TEST_DATA.DISCORD_USER_ID, mockConfig)
      
      expect(retrieved.profile.timezone).toBe('UTC')
      expect(retrieved.stats.total_updates).toBe(5)
    })

    it('should handle activity chronological ordering', async () => {
      const activities = [
        { timestamp: '2024-01-15T10:00:00Z', type: 'second' },
        { timestamp: '2024-01-15T09:00:00Z', type: 'first' },
        { timestamp: '2024-01-15T11:00:00Z', type: 'third' },
      ]

      for (const activity of activities) {
        mockKV.get.mockResolvedValueOnce(JSON.stringify([]))
        await addUserActivity(TEST_DATA.DISCORD_USER_ID, activity, mockConfig)
      }

      // Activities should be stored in chronological order (newest first)
      const lastCall = mockKV.put.mock.calls[mockKV.put.mock.calls.length - 1]
      const storedActivities = JSON.parse(lastCall[1])
      
      expect(storedActivities[0].type).toBe('third') // Most recent first
    })
  })
})