// src/index.js - Main entry point for the Cloudflare Worker

import { initializeConfig } from './config.js';
import { handleDiscordInteractions } from './discord/interactions.js';
import { handleDiscordWebhook } from './discord/webhook.js';
import { handleDirectStatusUpdate } from './api/status.js';

// Constants VERSION and BUILD_ID are now defined in config.js

export default {
  /**
   * Main fetch handler for the Cloudflare Worker
   * @param {Request} request The incoming request
   * @param {Env} env The environment object containing bindings (KV, secrets, vars)
   * @param {ExecutionContext} ctx The execution context
   * @returns {Promise<Response>} The response to send back
   */
  async fetch(request, env, ctx) {
    try {
      // Initialize configuration, passing the KV binding explicitly from the env object
      // The env object contains all bindings defined in wrangler.toml or the dashboard
      if (!env.STATUS_BOT_STORAGE) {
          // This check ensures the binding is present in the environment passed to the worker
          throw new Error('KV Namespace binding "STATUS_BOT_STORAGE" is missing in the worker environment (env object).');
      }
      // Pass the binding AND the full env object to the config initializer
      const config = await initializeConfig(env.STATUS_BOT_STORAGE, env);

      // Add config, env, and ctx to request context for handlers
      // Pass only necessary parts to handlers
      const handlerContext = { config, ctx };


      // Determine request type and route appropriately
      const url = new URL(request.url);

      // Route based on path
      if (request.method === 'POST' && url.pathname === '/interactions') {
        // Pass the full handlerContext now
        return handleDiscordInteractions(request, handlerContext);
      } else if (request.method === 'POST' && url.pathname === '/webhook') {
        return handleDiscordWebhook(request, handlerContext);
      } else if (request.method === 'POST' && url.pathname === '/update-status') {
        return handleDirectStatusUpdate(request, handlerContext);
      } else if (request.method === 'GET' && url.pathname === '/health') {
        // Access environment variable via env object now
        const currentEnv = config.getValue('environment', 'unknown'); // Get env from config
        return new Response(JSON.stringify({
          status: 'healthy',
          version: config.getVersion(), // Get version from config
          environment: currentEnv,
          buildId: config.getBuildId(), // Get buildId from config
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Default response for unknown endpoints or methods
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error handling request:', error.stack || error); // Log stack trace
      // Avoid leaking detailed errors in production responses
      // Access environment variable via env object now
      const currentEnv = env.ENVIRONMENT || 'unknown';
      const errorMessage = (currentEnv === 'production')
        ? 'Internal Server Error'
        : `Internal Server Error: ${error.message}`;
      return new Response(errorMessage, { status: 500 });
    }
  },
};
