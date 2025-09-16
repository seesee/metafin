# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainers directly with details
3. Include steps to reproduce the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Considerations

### API Keys and Secrets

- Never commit API keys or secrets to the repository
- Use environment variables for all sensitive configuration
- API keys are never exposed to the frontend

### Jellyfin Integration

- All Jellyfin communication goes through the backend
- Admin API key required for write operations
- Input validation on all Jellyfin API calls

### Provider APIs

- Rate limiting enforced on all external API calls
- Respect provider terms of service
- No scraping of prohibited sites

### Data Storage

- SQLite database stores metadata only
- No user credentials stored
- Regular backup recommendations provided

### Network Security

- Reverse proxy recommended for production
- CORS disabled by default for same-origin requests
- Security headers via Helmet

## Best Practices

- Run behind a reverse proxy with authentication
- Use read-only file system where possible
- Regular security updates via dependabot
- Monitor logs for unusual activity
