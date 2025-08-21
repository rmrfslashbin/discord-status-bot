// src/llm/health-check.js - LLM provider health monitoring

import { callAnthropicAPI } from './anthropic.js'
import { callOpenAIAPI } from './openai.js'
import { callOpenRouterAPI } from './openrouter.js'
import { TimeoutError } from '../utils/errors.js'
import { createLogger } from '../utils/logger.js'

/**
 * @typedef {import('../types.js').HealthCheckResult} HealthCheckResult
 * @typedef {import('../types.js').ProviderStatus} ProviderStatus
 */

/**
 * Health check manager for LLM providers
 */
export class LLMHealthCheck {
  constructor(config, logger = null) {
    this.config = config
    this.logger = logger || createLogger('llm-health-check')
    this.healthCache = new Map()
    this.cacheTimeout = 60000 // 1 minute cache
  }

  /**
   * Check health of all configured LLM providers
   * @returns {Promise<HealthCheckResult>} Health check results
   */
  async checkAllProviders() {
    const providers = ['anthropic', 'openai', 'openrouter']
    const results = {}
    let healthy = 0
    let total = 0

    for (const provider of providers) {
      // Only check providers that have API keys configured
      if (this.isProviderConfigured(provider)) {
        total++
        try {
          const status = await this.checkProvider(provider)
          results[provider] = status
          if (status.healthy) healthy++
        } catch (error) {
          this.logger.error(`Health check failed for ${provider}`, { error: error.message })
          results[provider] = {
            healthy: false,
            provider,
            responseTime: null,
            error: error.message,
            lastChecked: new Date().toISOString(),
          }
        }
      } else {
        results[provider] = {
          healthy: false,
          provider,
          responseTime: null,
          error: 'Provider not configured',
          lastChecked: new Date().toISOString(),
        }
      }
    }

    return {
      overall: {
        healthy: healthy > 0,
        healthyProviders: healthy,
        totalProviders: total,
        lastChecked: new Date().toISOString(),
      },
      providers: results,
    }
  }

  /**
   * Check health of a specific provider
   * @param {string} provider - Provider name (anthropic, openai, openrouter)
   * @returns {Promise<ProviderStatus>} Provider health status
   */
  async checkProvider(provider) {
    // Check cache first
    const cacheKey = `health_${provider}`
    const cached = this.healthCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.logger.debug(`Using cached health status for ${provider}`)
      return cached.status
    }

    this.logger.info(`Performing health check for ${provider}`)
    const startTime = Date.now()

    try {
      const success = await this.performHealthCheck(provider)
      const responseTime = Date.now() - startTime

      const status = {
        healthy: success,
        provider,
        responseTime,
        error: null,
        lastChecked: new Date().toISOString(),
      }

      // Cache the result
      this.healthCache.set(cacheKey, {
        status,
        timestamp: Date.now(),
      })

      this.logger.info(`Health check completed for ${provider}`, {
        healthy: success,
        responseTime,
      })

      return status
    } catch (error) {
      const responseTime = Date.now() - startTime
      const status = {
        healthy: false,
        provider,
        responseTime,
        error: error.message,
        lastChecked: new Date().toISOString(),
      }

      // Cache the error result (shorter cache time)
      this.healthCache.set(cacheKey, {
        status,
        timestamp: Date.now() - (this.cacheTimeout * 0.5), // Cache errors for half the time
      })

      this.logger.warn(`Health check failed for ${provider}`, {
        error: error.message,
        responseTime,
      })

      return status
    }
  }

  /**
   * Perform actual health check for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>} Whether the provider is healthy
   * @private
   */
  async performHealthCheck(provider) {
    const testPrompt = 'Health check'
    const testText = 'OK'

    // Use minimal parameters for health check
    const config = {
      ...this.config,
      llm: {
        ...this.config.llm,
        maxTokens: 10, // Minimal tokens for health check
        temperature: 0, // Deterministic response
      },
    }

    try {
      let response

      switch (provider) {
        case 'anthropic':
          response = await this.timeoutPromise(
            callAnthropicAPI(testPrompt, testText, config),
            5000, // 5 second timeout
          )
          break

        case 'openai':
          response = await this.timeoutPromise(
            callOpenAIAPI(testPrompt, testText, config),
            5000,
          )
          break

        case 'openrouter':
          response = await this.timeoutPromise(
            callOpenRouterAPI(testPrompt, testText, config),
            5000,
          )
          break

        default:
          throw new Error(`Unknown provider: ${provider}`)
      }

      // Check if we got a valid response
      if (typeof response === 'string' && response.length > 0) {
        this.logger.debug(`Health check response from ${provider}`, {
          responseLength: response.length,
        })
        return true
      } else {
        this.logger.warn(`Invalid health check response from ${provider}`, {
          response,
        })
        return false
      }
    } catch (error) {
      this.logger.error(`Health check error for ${provider}`, {
        error: error.message,
        errorType: error.constructor.name,
      })
      return false
    }
  }

  /**
   * Check if a provider is properly configured
   * @param {string} provider - Provider name
   * @returns {boolean} Whether the provider is configured
   * @private
   */
  isProviderConfigured(provider) {
    // Check if LLM credentials are set and match the provider
    const credentials = this.config.llm.apiKey
    if (!credentials) return false

    switch (provider) {
      case 'anthropic':
        return this.config.llm.service === 'anthropic' &&
               this.config.llm.anthropicEndpoint &&
               credentials.length > 0

      case 'openai':
        return this.config.llm.service === 'openai' &&
               this.config.llm.openaiEndpoint &&
               credentials.length > 0

      case 'openrouter':
        return this.config.llm.service === 'openrouter' &&
               this.config.llm.openrouterEndpoint &&
               credentials.length > 0

      default:
        return false
    }
  }

  /**
   * Get the best available provider
   * @returns {Promise<string|null>} Provider name or null if none available
   */
  async getBestProvider() {
    const healthResults = await this.checkAllProviders()

    // Sort providers by health and response time
    const healthyProviders = Object.values(healthResults.providers)
      .filter(status => status.healthy)
      .sort((a, b) => (a.responseTime || Infinity) - (b.responseTime || Infinity))

    if (healthyProviders.length === 0) {
      this.logger.warn('No healthy LLM providers available')
      return null
    }

    const bestProvider = healthyProviders[0]
    this.logger.info(`Selected best provider: ${bestProvider.provider}`, {
      responseTime: bestProvider.responseTime,
      totalHealthy: healthyProviders.length,
    })

    return bestProvider.provider
  }

  /**
   * Clear health check cache
   */
  clearCache() {
    this.healthCache.clear()
    this.logger.debug('Health check cache cleared')
  }

  /**
   * Wrap a promise with timeout
   * @param {Promise} promise - Promise to timeout
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise that rejects on timeout
   * @private
   */
  timeoutPromise(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(`Health check timed out after ${timeoutMs}ms`, timeoutMs, 'health-check'))
        }, timeoutMs)
      }),
    ])
  }
}

/**
 * Create health check instance with default configuration
 * @param {Object} config - Application configuration
 * @returns {LLMHealthCheck} Health check instance
 */
export function createHealthCheck(config) {
  return new LLMHealthCheck(config)
}

/**
 * Quick health check for all providers
 * @param {Object} config - Application configuration
 * @returns {Promise<HealthCheckResult>} Health check results
 */
export async function quickHealthCheck(config) {
  const healthCheck = createHealthCheck(config)
  return await healthCheck.checkAllProviders()
}

/**
 * Get health status for Discord embed
 * @param {Object} config - Application configuration
 * @returns {Promise<Object>} Discord embed data
 */
export async function getHealthStatusEmbed(config) {
  const results = await quickHealthCheck(config)

  const embedFields = []

  // Overall status
  embedFields.push({
    name: '🎯 Overall Status',
    value: results.overall.healthy
      ? `✅ Healthy (${results.overall.healthyProviders}/${results.overall.totalProviders} providers)`
      : '❌ Unhealthy (no providers available)',
    inline: false,
  })

  // Individual provider status
  for (const [provider, status] of Object.entries(results.providers)) {
    const icon = status.healthy ? '✅' : '❌'
    const responseTime = status.responseTime ? `${status.responseTime}ms` : 'N/A'
    const errorInfo = status.error ? ` - ${status.error}` : ''

    embedFields.push({
      name: `${icon} ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
      value: `Response: ${responseTime}${errorInfo}`,
      inline: true,
    })
  }

  return {
    title: '🔍 LLM Provider Health Status',
    color: results.overall.healthy ? 0x00ff00 : 0xff0000,
    fields: embedFields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Health checks are cached for 1 minute',
    },
  }
}