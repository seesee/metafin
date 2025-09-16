# metafin

A comprehensive metadata management tool for Jellyfin, focused on series, seasons, and episodes.

## Overview

metafin helps you maintain accurate metadata for your Jellyfin media library by:

- **Provider Integration**: Search and match content using TVMaze, Wikidata, and TMDb
- **Bulk Operations**: Apply metadata changes to multiple items with preview and confirmation
- **Smart Collections**: Create rule-based collections that update automatically
- **Artwork Management**: Download and apply high-quality artwork from multiple sources
- **Misclassification Detection**: Identify and resolve incorrectly categorised content

## Quick Start

### Prerequisites

- Node.js 20 or higher
- Jellyfin 10.10.7 server with admin API access
- Optional: TMDb API key for enhanced artwork

### Installation

```bash
# Clone the repository
git clone https://github.com/seesee/metafin.git
cd metafin

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Configuration

1. Set environment variables:

   ```bash
   JELLYFIN_URL=http://your-jellyfin-server:8096
   JELLYFIN_API_KEY=your-admin-api-key
   TMDB_API_KEY=your-tmdb-key  # optional
   ```

2. Access the web interface at `http://localhost:3000`

## Architecture

- **Backend**: NestJS + Prisma + SQLite
- **Frontend**: SvelteKit + Tailwind CSS + i18next
- **Providers**: TVMaze, Wikidata, TMDb (optional)
- **Target**: Jellyfin 10.10.7 compatibility

## Development

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format

# Database operations
pnpm db:migrate
pnpm db:seed
```

## Production Deployment

Use the provided Docker image:

```bash
docker run -d \
  --name metafin \
  -p 8080:8080 \
  -v metafin-data:/data \
  -e JELLYFIN_URL=http://jellyfin:8096 \
  -e JELLYFIN_API_KEY=your-api-key \
  ghcr.io/seesee/metafin:latest
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
