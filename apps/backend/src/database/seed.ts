#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Seed initial settings
  await prisma.setting.upsert({
    where: { key: 'app_version' },
    update: { value: '0.1.0' },
    create: {
      key: 'app_version',
      value: '0.1.0',
    },
  });

  await prisma.setting.upsert({
    where: { key: 'last_sync_at' },
    update: {},
    create: {
      key: 'last_sync_at',
      value: new Date().toISOString(),
    },
  });

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
