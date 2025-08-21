# External Monitoring and Alerting Guide

## What is External Monitoring and Alerting?

External monitoring and alerting refers to systems that watch your Discord bot from **outside** the application itself to ensure it's healthy, performing well, and meeting user expectations. Think of it as having a separate guardian that constantly checks if your bot is alive and well.

## Why External Monitoring?

### The Problem with Internal-Only Monitoring
- **If your bot crashes**, internal monitoring crashes too
- **Network issues** might prevent internal alerts from being sent
- **Cloudflare Worker limits** might cause monitoring to fail silently
- **You won't know** if the entire service is down

### Benefits of External Monitoring
1. **Independent verification** that your service is accessible
2. **Real user perspective** - monitors what users actually experience
3. **Global monitoring** - check from multiple geographic locations
4. **Proactive alerts** - know about issues before users complain
5. **Historical data** - track performance trends over time

## Components of External Monitoring

### 1. Uptime Monitoring
**What it does**: Regularly pings your endpoints to verify they're responding

```yaml
Monitors:
  - Status Dashboard: https://your-bot.workers.dev/api/status
    Check Interval: 5 minutes
    Timeout: 10 seconds
    Expected Status: 200 OK
    
  - Discord Webhook Health: POST /interactions
    Check Interval: 15 minutes
    Validate: Response contains expected JSON structure
```

**Tools**:
- **Better Uptime** (Free tier available)
- **Uptime Robot** (Free for 50 monitors)
- **Pingdom** (More advanced, paid)
- **StatusCake** (Good free tier)

### 2. Synthetic Monitoring
**What it does**: Simulates real user interactions with your bot

```javascript
// Example synthetic test
async function syntheticStatusUpdate() {
  // 1. Send status update command
  const response = await sendDiscordCommand('/status update "Test"')
  
  // 2. Verify response received
  assert(response.status === 200)
  
  // 3. Check dashboard updated
  const dashboard = await fetch('/api/status/user123')
  assert(dashboard.includes('Test'))
  
  // 4. Measure total time
  assert(totalTime < 5000) // Should complete in 5 seconds
}
```

**Tools**:
- **Checkly** (API & browser checks)
- **Datadog Synthetics**
- **New Relic Synthetics**

### 3. Performance Monitoring
**What it does**: Tracks response times, latency, and throughput

```yaml
Metrics to Track:
  - API Response Time: < 500ms p95
  - LLM Processing Time: < 3s p95
  - Discord Interaction Response: < 3s (Discord requirement)
  - KV Storage Operations: < 100ms p95
  - Error Rate: < 1%
```

### 4. Error Tracking
**What it does**: Captures and alerts on application errors

**Integration with Sentry**:
```javascript
// In your worker
import * as Sentry from '@sentry/cloudflare'

export default {
  async fetch(request, env, ctx) {
    return Sentry.withSentry(env, ctx, async () => {
      try {
        return await handleRequest(request, env)
      } catch (error) {
        Sentry.captureException(error)
        throw error
      }
    })
  }
}
```

### 5. Cost Monitoring
**What it does**: Tracks API usage and costs

```yaml
Monitor:
  - Cloudflare Workers Invocations
  - KV Storage Operations
  - LLM API Calls (Anthropic/OpenAI)
  - Bandwidth Usage
  
Alerts:
  - Daily cost > $10
  - Unusual spike in API calls
  - Rate limit approaching
```

## Setting Up External Monitoring

### Step 1: Basic Uptime Monitoring (Free - Better Uptime)

1. **Sign up** at https://betteruptime.com
2. **Add monitor**:
   ```
   URL: https://your-bot.workers.dev/api/status
   Check Type: HTTP(S)
   Method: GET
   Interval: 3 minutes
   Locations: US East, US West, EU
   ```
3. **Set up alerts**:
   - Email on first failure
   - Discord webhook notification
   - SMS for extended downtime

### Step 2: Status Page

Create a public status page for transparency:

```yaml
Components:
  - Discord Bot API: Operational
  - LLM Processing: Operational
  - Status Dashboard: Operational
  - KV Storage: Operational
  
Metrics Display:
  - Current uptime: 99.95%
  - Response time: 245ms avg
  - Active users: 1,234
```

**Recommended**: Use Better Uptime's status page or GitHub Pages

### Step 3: Advanced Monitoring (Datadog)

```javascript
// datadog-monitor.js
const monitors = [
  {
    name: 'Discord Bot Health Check',
    type: 'api',
    url: 'https://your-bot.workers.dev/api/health',
    assertions: [
      { type: 'statusCode', operator: 'is', target: 200 },
      { type: 'responseTime', operator: 'lessThan', target: 1000 },
      { type: 'body', operator: 'contains', target: 'healthy' }
    ],
    locations: ['aws:us-east-1', 'aws:eu-west-1'],
    frequency: 300 // 5 minutes
  }
]
```

## Alert Configuration

### Alert Hierarchy

```yaml
Critical (Page immediately):
  - Complete service down > 1 minute
  - Error rate > 10%
  - All LLM providers failing
  
High (Notify within 5 min):
  - Single endpoint down > 5 minutes
  - Response time > 5s
  - KV storage errors
  
Medium (Notify within 30 min):
  - Degraded performance
  - Single LLM provider failing
  - Rate limiting triggered frequently
  
Low (Daily summary):
  - Minor performance variations
  - Successful failover events
  - Usage statistics
```

### Alert Channels

1. **Email**: For all alerts
2. **Discord Webhook**: Post to admin channel
3. **SMS/Phone**: Critical alerts only
4. **Slack**: Team notifications
5. **PagerDuty**: For on-call rotation

## Monitoring Dashboard Example

```javascript
// monitoring-config.json
{
  "services": {
    "discord-bot": {
      "endpoints": [
        {
          "name": "Health Check",
          "url": "/api/health",
          "interval": 300,
          "timeout": 10000,
          "expectedStatus": 200
        },
        {
          "name": "Status Dashboard",
          "url": "/api/status",
          "interval": 600,
          "timeout": 15000
        }
      ],
      "alerts": {
        "channels": ["email", "discord"],
        "thresholds": {
          "uptime": 99.5,
          "responseTime": 1000,
          "errorRate": 1
        }
      }
    }
  },
  "integrations": {
    "discord": {
      "webhook": "https://discord.com/api/webhooks/..."
    },
    "email": {
      "to": ["admin@example.com"]
    }
  }
}
```

## Implementation Priority

### Phase 1: Basic Monitoring (Week 1)
- ✅ Set up Better Uptime for endpoint monitoring
- ✅ Create simple health check endpoint
- ✅ Configure email alerts
- ✅ Set up public status page

### Phase 2: Error Tracking (Week 2)
- 🔄 Integrate Sentry for error tracking
- 🔄 Set up error alerts
- 🔄 Create error dashboard

### Phase 3: Performance Monitoring (Week 3)
- 📋 Add custom metrics to Cloudflare Analytics
- 📋 Set up Datadog or New Relic
- 📋 Create performance dashboards
- 📋 Configure performance alerts

### Phase 4: Advanced Monitoring (Week 4)
- 📋 Implement synthetic monitoring
- 📋 Set up cost tracking
- 📋 Create automated reports
- 📋 Implement SLA tracking

## Cost Considerations

### Free Options
- **Better Uptime**: 10 monitors, 3-minute checks
- **Uptime Robot**: 50 monitors, 5-minute checks
- **Sentry**: 5K events/month
- **Cloudflare Analytics**: Included with Workers

### Paid Options (Estimated Monthly)
- **Datadog**: $15-50/host
- **New Relic**: $25-100/month
- **Pingdom**: $10-45/month
- **PagerDuty**: $20-50/user

## Monitoring Best Practices

1. **Start simple**: Begin with uptime monitoring, add complexity gradually
2. **Monitor from multiple locations**: Ensure global coverage
3. **Set realistic thresholds**: Avoid alert fatigue
4. **Document runbooks**: Clear instructions for handling alerts
5. **Regular reviews**: Adjust thresholds based on actual performance
6. **Test alerts**: Verify alerts work before you need them
7. **Monitor the monitors**: Ensure monitoring system itself is working

## Example Runbook

### When "Service Down" Alert Fires:

1. **Verify** the issue (check from different location)
2. **Check** Cloudflare status page
3. **Review** recent deployments
4. **Check** KV storage status
5. **Verify** Discord API status
6. **Check** LLM provider status
7. **Rollback** if recent deployment caused issue
8. **Communicate** on status page
9. **Post-mortem** after resolution

## Recommended Setup for Discord Status Bot

### Minimum Viable Monitoring
```yaml
Service: Better Uptime (Free)
Monitors:
  - Health endpoint (3 min interval)
  - Status dashboard (5 min interval)
  
Alerts:
  - Email on failure
  - Discord webhook to admin channel
  
Status Page: GitHub Pages with uptime badge
```

### Production Monitoring
```yaml
Services:
  - Datadog for APM and synthetic monitoring
  - Sentry for error tracking
  - Better Uptime for uptime monitoring
  - Cloudflare Analytics for metrics
  
Monitors:
  - All endpoints (1 min interval)
  - Synthetic user journeys
  - LLM API availability
  - Cost tracking
  
Alerts:
  - PagerDuty for critical
  - Slack for team notifications
  - Email for reports
  
Dashboards:
  - Executive dashboard (KPIs)
  - Technical dashboard (performance)
  - Cost dashboard (usage & spend)
```

## Conclusion

External monitoring and alerting is your safety net that ensures your Discord bot remains reliable and performant. Start with basic uptime monitoring and gradually add more sophisticated monitoring as your bot grows. Remember: it's better to know about problems from your monitoring than from angry users!