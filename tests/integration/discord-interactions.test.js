// Integration tests for Discord interactions
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handleDiscordInteractions } from '../../src/discord/interactions.js'
import { createMockConfig, TEST_DATA } from '../setup.js'

// Mock external dependencies
vi.mock('../../src/discord/verify.js', () => ({
  verifyDiscordRequest: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../src/api/status.js', () => ({
  processStatusUpdate: vi.fn().mockResolvedValue('message-id-123'),
}))

vi.mock('../../src/discord/utility-commands.js', () => ({
  handleHealthCommand: vi.fn().mockResolvedValue({
    embeds: [{ title: 'Health Status' }],
    ephemeral: true,
  }),
  handlePurgeCommand: vi.fn().mockResolvedValue({
    content: 'Data purged successfully',
    ephemeral: true,
  }),
  handleInfoCommand: vi.fn().mockResolvedValue({
    embeds: [{ title: 'Bot Information' }],
    ephemeral: true,
  }),
}))

vi.mock('../../src/discord/stats.js', () => ({
  handleStatsCommand: vi.fn().mockResolvedValue({
    type: 4,
    data: {
      embeds: [{ title: 'Statistics' }],
      ephemeral: true,
    },
  }),
}))

vi.mock('../../src/discord/profile.js', () => ({
  handleProfileCommand: vi.fn().mockResolvedValue({
    embeds: [{ title: 'User Profile' }],
    ephemeral: true,
  }),
}))

vi.mock('../../src/discord/emoji.js', () => ({
  handleEmojiCommand: vi.fn().mockResolvedValue({
    content: 'Emoji settings updated',
    ephemeral: true,
  }),
}))

vi.mock('../../src/discord/components.js', () => ({
  handleComponentInteraction: vi.fn().mockResolvedValue({
    content: 'Component interaction handled',
    ephemeral: true,
  }),
}))

vi.mock('../../src/discord/api.js', () => ({
  editInteractionResponse: vi.fn().mockResolvedValue(true),
  sendInteractionFollowup: vi.fn().mockResolvedValue(true),
}))

import { verifyDiscordRequest } from '../../src/discord/verify.js'
import { processStatusUpdate } from '../../src/api/status.js'
import * as utilityCommands from '../../src/discord/utility-commands.js'
import * as statsHandler from '../../src/discord/stats.js'
import * as profileHandler from '../../src/discord/profile.js'
import * as emojiHandler from '../../src/discord/emoji.js'
import * as componentsHandler from '../../src/discord/components.js'
import { editInteractionResponse } from '../../src/discord/api.js'

describe('Discord Interactions Integration', () => {
  let mockConfig
  let mockContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig = createMockConfig()
    mockContext = {
      config: mockConfig,
      ctx: {
        waitUntil: vi.fn((promise) => promise),
      },
    }
  })

  describe('Interaction signature verification', () => {
    it('should reject interactions with invalid signatures', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(false)
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'invalid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(TEST_DATA.SAMPLE_DISCORD_INTERACTION),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(401)
      expect(await response.text()).toContain('Invalid request signature')
    })

    it('should accept interactions with valid signatures', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const pingInteraction = {
        type: 1, // PING
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(pingInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(1) // PONG
    })
  })

  describe('PING interactions', () => {
    it('should respond to ping with pong', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const pingInteraction = { type: 1 }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(pingInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(1) // PONG
    })
  })

  describe('Status update command', () => {
    it('should handle status update command', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const statusUpdateInteraction = {
        type: 2, // APPLICATION_COMMAND
        token: 'interaction-token',
        data: {
          name: 'status',
          options: [
            {
              name: 'update',
              type: 1,
              options: [
                {
                  name: 'text',
                  type: 3,
                  value: 'Working on the Discord bot',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: TEST_DATA.DISCORD_USER_ID,
          },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(statusUpdateInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(5) // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      
      // Verify that processStatusUpdate was called
      await vi.waitFor(() => {
        expect(processStatusUpdate).toHaveBeenCalledWith(
          'Working on the Discord bot',
          TEST_DATA.DISCORD_USER_ID,
          mockConfig,
        )
      })
      
      // Verify that the deferred response was edited
      await vi.waitFor(() => {
        expect(editInteractionResponse).toHaveBeenCalledWith(
          'interaction-token',
          expect.objectContaining({
            content: expect.stringContaining('✅ Your status dashboard has been updated'),
          }),
          mockConfig,
        )
      })
    })

    it('should handle status update validation errors', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const invalidStatusInteraction = {
        type: 2,
        token: 'interaction-token',
        data: {
          name: 'status',
          options: [
            {
              name: 'update',
              type: 1,
              options: [
                {
                  name: 'text',
                  type: 3,
                  value: '', // Empty text should fail validation
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: TEST_DATA.DISCORD_USER_ID,
          },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(invalidStatusInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.content).toContain('Invalid input')
    })
  })

  describe('Utility commands', () => {
    it('should handle health command', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const healthInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [{ name: 'health', type: 1 }],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(healthInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      expect(utilityCommands.handleHealthCommand).toHaveBeenCalledWith(
        healthInteraction,
        mockContext,
      )
    })

    it('should handle purge command with deferred response', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const purgeInteraction = {
        type: 2,
        token: 'interaction-token',
        data: {
          name: 'status',
          options: [
            {
              name: 'purge',
              type: 1,
              options: [{ name: 'confirm', type: 5, value: true }],
            },
          ],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(purgeInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(5) // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      
      // Verify that purge handler was called
      await vi.waitFor(() => {
        expect(utilityCommands.handlePurgeCommand).toHaveBeenCalledWith(
          purgeInteraction,
          mockContext,
        )
      })
    })

    it('should handle stats command', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const statsInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [
            {
              name: 'stats',
              type: 1,
              options: [{ name: 'timeframe', type: 3, value: '1h' }],
            },
          ],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(statsInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      expect(statsHandler.handleStatsCommand).toHaveBeenCalledWith(
        statsInteraction,
        mockContext,
      )
    })
  })

  describe('Profile and emoji commands', () => {
    it('should handle profile commands', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const profileInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [
            {
              name: 'profile',
              type: 2, // SUB_COMMAND_GROUP
              options: [{ name: 'view', type: 1 }],
            },
          ],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(profileInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      expect(profileHandler.handleProfileCommand).toHaveBeenCalledWith(
        profileInteraction,
        mockContext,
      )
    })

    it('should handle emoji commands', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const emojiInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [
            {
              name: 'emoji',
              type: 2, // SUB_COMMAND_GROUP
              options: [{ name: 'list', type: 1 }],
            },
          ],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(emojiInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      expect(emojiHandler.handleEmojiCommand).toHaveBeenCalledWith(
        emojiInteraction,
        mockContext,
      )
    })
  })

  describe('Component interactions', () => {
    it('should handle button interactions with deferred response', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const buttonInteraction = {
        type: 3, // MESSAGE_COMPONENT
        token: 'interaction-token',
        data: {
          custom_id: 'react:like',
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(buttonInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(6) // DEFERRED_UPDATE_MESSAGE
      
      // Verify component handler was called
      await vi.waitFor(() => {
        expect(componentsHandler.handleComponentInteraction).toHaveBeenCalledWith(
          buttonInteraction,
          mockContext,
        )
      })
    })

    it('should handle non-deferred component interactions', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const buttonInteraction = {
        type: 3, // MESSAGE_COMPONENT
        data: {
          custom_id: 'show_details:user123',
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(buttonInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.type).toBe(4) // CHANNEL_MESSAGE_WITH_SOURCE
      expect(componentsHandler.handleComponentInteraction).toHaveBeenCalledWith(
        buttonInteraction,
        mockContext,
      )
    })
  })

  describe('Error handling', () => {
    it('should handle unknown subcommands gracefully', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const unknownInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [{ name: 'unknown_command', type: 1 }],
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(unknownInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.content).toContain('Unknown command received')
      expect(data.data.flags).toBe(64) // Ephemeral
    })

    it('should handle missing subcommands', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const missingSubcommandInteraction = {
        type: 2,
        data: {
          name: 'status',
          options: [], // No subcommand
        },
        member: {
          user: { id: TEST_DATA.DISCORD_USER_ID },
        },
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(missingSubcommandInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.content).toContain('Please specify a subcommand')
    })

    it('should handle unhandled interaction types', async () => {
      verifyDiscordRequest.mockResolvedValueOnce(true)
      
      const unknownTypeInteraction = {
        type: 99, // Unknown type
      }
      
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'valid-signature',
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(unknownTypeInteraction),
      })
      
      const response = await handleDiscordInteractions(request, mockContext)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.content).toContain('This interaction type is not handled yet')
    })
  })
})