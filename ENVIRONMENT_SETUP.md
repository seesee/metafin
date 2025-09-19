# Environment Setup Guide

This guide explains how to configure and run Metafin in different environments: development, staging, and production.

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up your environment:**
   ```bash
   # Copy the development environment template
   cp .env.example .env.development

   # Edit the file with your Jellyfin details
   nano .env.development
   ```

3. **Run in development mode:**
   ```bash
   pnpm dev
   ```

## Environment Files

Metafin uses environment-specific configuration files:

- `.env.development` - Local development settings
- `.env.staging` - Staging environment settings
- `.env.production` - Production environment settings
- `.env.example` - Template with all available options

### Important Security Notes

- **Never commit actual `.env.*` files to git** - they contain sensitive information
- The `.env.example` file is safe to commit as it contains only templates
- Use different API keys and credentials for each environment

## Available Commands

### Development
```bash
# Start both frontend and backend in development mode
pnpm dev

# Start with staging configuration
pnpm dev:staging
```

### Building
```bash
# Build for development (default)
pnpm build

# Build for staging
pnpm build:staging

# Build for production
pnpm build:production
```

### Production
```bash
# Start in production mode
pnpm start

# Start in staging mode
pnpm start:staging
```

### Database Operations
```bash
# Development database operations
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed with test data
pnpm db:reset        # Reset database

# Staging database operations
pnpm db:migrate:staging

# Production database operations
pnpm db:migrate:production
```

## Environment Variables Reference

### Application Settings
- `NODE_ENV` - Environment mode (development/staging/production)
- `APP_PORT` - Backend API server port (default: 8080)
- `FRONTEND_PORT` - Frontend development server port (default: 3000)
- `BASE_PATH` - Base path for reverse proxy setup
- `LOG_LEVEL` - Logging verbosity (trace/debug/info/warn/error/fatal)

### Database
- `DATABASE_URL` - SQLite database file path

### Jellyfin Integration
- `JELLYFIN_URL` - Your Jellyfin server URL
- `JELLYFIN_API_KEY` - API key from Jellyfin dashboard

### Metadata Providers
- `TMDB_API_KEY` - TMDb API key (optional, enhances metadata)

### Frontend Configuration
- `PUBLIC_BASE_PATH` - Public base path for frontend assets
- `PUBLIC_API_URL` - Backend API URL for production builds

## Port Configuration

The application uses the following ports by default:

- **Frontend (Vite dev server)**: 3000
- **Backend (NestJS API)**: 8080
- **Frontend → Backend Proxy**: `/api` routes are proxied to backend

### How the Proxy Works

In development, when you visit `http://localhost:3000/api/health`, Vite automatically proxies this request to `http://localhost:8080/api/health` on the backend.

This means:
- Frontend runs on port 3000
- Backend runs on port 8080
- API calls from frontend work seamlessly via proxy

## Troubleshooting

### Frontend can't connect to backend

1. **Check ports match:** Ensure `APP_PORT` in your env file matches the port the backend is actually running on
2. **Check environment loading:** Run `pnpm dev` (not just `pnpm -r dev`) to ensure environment variables are loaded
3. **Check proxy configuration:** The Vite config should show the correct backend URL in console

### Environment variables not loading

1. **Use the correct command:** Always use `pnpm dev` instead of manually running individual services
2. **Check file names:** Ensure your environment files are named exactly `.env.development`, etc.
3. **Check file location:** Environment files should be in the root directory (same level as package.json)

### Database issues

1. **Run migrations:** `pnpm db:migrate` to ensure database schema is up to date
2. **Check DATABASE_URL:** Ensure the path is correct for your environment
3. **Permissions:** Ensure the app can write to the database directory

## Docker Deployment

For production deployment with Docker:

```bash
# Build the Docker image
pnpm docker:build

# Run with production environment
docker run -p 8080:8080 -v metafin-data:/data -e NODE_ENV=production metafin
```

## Reverse Proxy Setup

When running behind a reverse proxy (nginx, Apache, Traefik):

1. Set `BASE_PATH` to your subdirectory (e.g., `/metafin`)
2. Set `PUBLIC_BASE_PATH` to the same value
3. Set `TRUST_PROXY=true`
4. Configure your proxy to forward to port 8080

Example nginx configuration:
```nginx
location /metafin/ {
    proxy_pass http://localhost:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```