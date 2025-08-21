# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in the Discord Status Bot, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [security contact] 
3. Provide detailed information about the vulnerability
4. Allow reasonable time for the issue to be resolved before public disclosure

## Security Measures

### Secrets Management

All sensitive data is properly secured using Cloudflare Workers secrets:

#### **Cloudflare Secrets (Encrypted)**
- `DISCORD_APPLICATION_ID` - Discord application ID
- `DISCORD_BOT_TOKEN` - Discord bot authentication token
- `DISCORD_PUBLIC_KEY` - Discord public key for signature verification
- `LLM_CREDENTIALS` - LLM API keys (format: `provider:api_key`)

#### **Environment Variables (Public)**
- `ENVIRONMENT` - Deployment environment name
- `DISCORD_API_VERSION` - Discord API version
- `STATUS_CHANNEL_ID` - Discord channel ID for status messages
- `LLM_MODEL` - LLM model name
- `LLM_MAX_TOKENS` - Token limit for LLM requests
- `LLM_TEMPERATURE` - LLM temperature setting

### Configuration Security

The `src/config.js` module implements secure configuration management:

1. **Validation**: All required secrets and variables are validated at startup
2. **Type Safety**: Numeric values are properly parsed and validated
3. **Error Handling**: Missing or invalid configuration fails securely
4. **Separation**: Clear separation between public vars and encrypted secrets

### Input Validation

- Discord interaction signatures are verified using `DISCORD_PUBLIC_KEY`
- All user inputs are sanitized before processing
- LLM inputs are validated for length and content
- Status text is limited to prevent abuse

### Logging Security

- Structured logging with trace IDs for debugging
- **No sensitive data** (API keys, tokens, personal info) is logged
- User IDs are logged for functionality but not personal data
- Error logs include context without exposing secrets

### API Security

- **Discord API**: Proper authentication with bot tokens
- **LLM APIs**: Secure credential storage and transmission
- **Rate Limiting**: Implemented at the Cloudflare Workers level
- **Request Validation**: All incoming requests are validated

### Data Storage Security

- **KV Storage**: Only non-sensitive data stored in Cloudflare KV
- **User Profiles**: No personally identifiable information stored
- **Status History**: Limited to 3 entries to minimize exposure
- **Activity Data**: Minimal data retention policy

## Security Best Practices

### For Developers

1. **Never commit secrets** to version control
2. **Use structured logging** - avoid logging sensitive data
3. **Validate all inputs** at module boundaries
4. **Implement error handling** that doesn't expose internal details
5. **Use TypeScript/JSDoc** for better type safety
6. **Regular dependency updates** to patch vulnerabilities

### For Deployment

1. **Separate environments** (dev, staging, production)
2. **Different Discord applications** for each environment
3. **Rotate API keys** regularly
4. **Monitor usage** through Cloudflare dashboard
5. **Set up alerts** for unusual activity
6. **Backup configurations** securely

### For Operations

1. **Monitor logs** for security events
2. **Track API usage** to detect abuse
3. **Regular security audits** of configuration
4. **Keep dependencies updated**
5. **Review access permissions** regularly

## Threat Model

### Potential Threats

1. **API Key Exposure**: Mitigated by Cloudflare secrets encryption
2. **Discord Signature Bypass**: Mitigated by signature verification
3. **LLM Prompt Injection**: Mitigated by input sanitization
4. **Data Exfiltration**: Mitigated by minimal data storage
5. **Service Abuse**: Mitigated by rate limiting and validation

### Attack Vectors

1. **Malicious Discord Commands**: All interactions are validated
2. **Environment Variable Exposure**: Sensitive data in encrypted secrets
3. **Log Injection**: Structured logging prevents log tampering
4. **KV Storage Access**: Only non-sensitive data stored
5. **Network Interception**: HTTPS everywhere

## Compliance

### Data Protection

- **Minimal Data Collection**: Only necessary functional data
- **Data Retention**: Limited history and automatic cleanup
- **User Privacy**: No personal information stored beyond Discord IDs
- **Right to Deletion**: Purge command removes all user data

### Security Standards

- **Encryption**: All secrets encrypted at rest and in transit
- **Authentication**: Proper Discord OAuth and API authentication
- **Authorization**: Role-based access through Discord permissions
- **Audit Trail**: Comprehensive logging with trace IDs

## Security Updates

This document is updated whenever:
- New security measures are implemented
- Threat model changes
- Security vulnerabilities are discovered and fixed
- Best practices evolve

Last updated: January 2025

## Security Checklist

### Before Deployment

- [ ] All secrets properly configured in Cloudflare
- [ ] No hardcoded credentials in code
- [ ] Discord signature verification working
- [ ] Input validation implemented
- [ ] Error handling doesn't expose sensitive data
- [ ] Logs reviewed for sensitive data leakage
- [ ] Dependencies updated and scanned
- [ ] Rate limiting configured

### Regular Maintenance

- [ ] Monthly dependency updates
- [ ] Quarterly API key rotation
- [ ] Regular log review for security events
- [ ] Monitor Cloudflare security alerts
- [ ] Review user activity patterns
- [ ] Update security documentation

---

For questions about security practices or to report vulnerabilities, please follow the reporting guidelines above.