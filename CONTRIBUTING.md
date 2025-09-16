# Contributing to metafin

Thank you for your interest in contributing to metafin! This document provides guidelines for contributing to the project.

## Development Setup

1. **Prerequisites**
   - Node.js 20 or higher
   - pnpm (latest version)
   - Docker (for testing with Jellyfin)

2. **Getting Started**
   ```bash
   git clone https://github.com/seesee/metafin.git
   cd metafin
   pnpm install
   pnpm dev
   ```

## Code Standards

- **Language**: British English for all user-facing text
- **TypeScript**: Strict mode required (`noImplicitAny`, `strictNullChecks`)
- **Formatting**: Prettier with 80 character line width
- **Linting**: ESLint configuration must pass
- **Testing**: Unit tests required for new features

## Pull Request Process

1. **Branch Naming**: Use descriptive names (e.g., `feat/provider-tvmaze`, `fix/auth-headers`)
2. **Commits**: Follow Conventional Commits specification
3. **Testing**: Ensure all tests pass locally
4. **Documentation**: Update relevant documentation

## Architecture Guidelines

- **Backend**: NestJS + Prisma + SQLite
- **Frontend**: SvelteKit + Tailwind + i18next
- **Providers**: TVMaze, Wikidata (default), TMDb (optional with API key)
- **Target**: Jellyfin 10.10.7 compatibility

## Accessibility Requirements

- All UI components must be keyboard navigable
- ARIA labels required for interactive elements
- High contrast theme support
- Screen reader compatibility

## Internationalisation (i18n)

- All user-visible strings must use i18next keys
- No hard-coded text in components
- Default locale: en-GB
- Date/time formatting via Intl API

## Security Guidelines

- Never expose API keys or secrets to frontend
- All inputs must be validated and sanitised
- Follow provider rate limiting requirements
- Redact sensitive information from logs

## Questions?

- Check existing issues on GitHub
- Review the CLAUDE.md file for detailed guidelines
- Open a discussion for architectural questions
