# Metafin Quick Start Guide

## TL;DR - Get Running in 2 Minutes

```bash
# 1. Copy and configure your environment
cp .env.example .env.development
# Edit .env.development with your Jellyfin details

# 2. Install dependencies
pnpm install

# 3. Set up database
pnpm db:migrate

# 4. Start the application
pnpm dev
```

Your app will be running at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API calls from frontend work automatically** via proxy

## What Just Happened?

The `pnpm dev` command:
1. ✅ Loads `.env.development` environment variables
2. ✅ Starts backend on port 8080 (from `APP_PORT`)
3. ✅ Starts frontend on port 3000 (from `FRONTEND_PORT`)
4. ✅ Sets up automatic proxy: frontend `/api/*` → backend `http://localhost:8080/api/*`

## Environment Configuration

| File | Purpose | When to Use |
|------|---------|-------------|
| `.env.development` | Local development | Default - edit with your Jellyfin details |
| `.env.staging` | Staging environment | `pnpm dev:staging` |
| `.env.production` | Production environment | `pnpm start` |
| `.env.example` | Template with examples | Reference only - safe to commit |

## All Available Commands

```bash
# Development
pnpm dev                    # Start with development config
pnpm dev:staging           # Start with staging config

# Building
pnpm build                 # Build for development
pnpm build:staging         # Build for staging
pnpm build:production      # Build for production

# Production
pnpm start                 # Start in production mode
pnpm start:staging         # Start in staging mode

# Database
pnpm db:migrate            # Run database migrations (dev)
pnpm db:migrate:staging    # Run migrations for staging
pnpm db:migrate:production # Run migrations for production
pnpm db:seed               # Add sample data
pnpm db:reset              # Reset development database

# Quality
pnpm lint                  # Run linting
pnpm typecheck             # Check TypeScript types
pnpm test                  # Run tests
```

## Troubleshooting

### "Frontend can't connect to backend"
- ✅ **Use `pnpm dev`** (not `pnpm -r dev`) to load environment variables
- ✅ **Check your `.env.development`** has `APP_PORT=8080`
- ✅ **Verify ports** in the console output match your config

### "Environment variables not loading"
- ✅ **File location**: Environment files must be in the root directory
- ✅ **File names**: Must be exactly `.env.development`, etc.
- ✅ **Use correct command**: Always `pnpm dev`, not individual service commands

### "Database errors"
- ✅ **Run migrations**: `pnpm db:migrate`
- ✅ **Check permissions**: Ensure app can write to database directory
- ✅ **Reset if needed**: `pnpm db:reset` (development only)

## What You Need to Configure

### Required (in .env.development)
- `JELLYFIN_URL` - Your Jellyfin server URL
- `JELLYFIN_API_KEY` - Generate in Jellyfin Dashboard → Advanced → API Keys

### Optional
- `TMDB_API_KEY` - For enhanced metadata (sign up at themoviedb.org)
- `LOG_LEVEL` - Set to `debug` for development
- `APP_PORT` - Backend port (default: 8080)
- `FRONTEND_PORT` - Frontend port (default: 3000)

## Need More Details?

- 📚 **Full setup guide**: [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
- 🐛 **Issues**: Check the troubleshooting section above
- 🚀 **Production deployment**: See Docker section in ENVIRONMENT_SETUP.md

## Security Note

🔒 **Never commit `.env.*` files** - they contain sensitive API keys!
✅ Only `.env.example` is safe to commit (it's just a template)