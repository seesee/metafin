import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().positive().max(65535).default(8080),
  BASE_PATH: z.string().default('/'),
  JELLYFIN_URL: z.string().url().optional(),
  JELLYFIN_API_KEY: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().default('file:/data/app.db'),
  TRUST_PROXY: z.enum(['true', 'false']).default('true'),
  DEFAULT_LOCALE: z.string().default('en-GB'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

export type Config = z.infer<typeof configSchema>;
