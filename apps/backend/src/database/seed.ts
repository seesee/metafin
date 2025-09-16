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

  // Seed demo library (if in development)
  if (process.env.NODE_ENV === 'development') {
    const demoLibrary = await prisma.library.upsert({
      where: { id: 'demo-library-1' },
      update: {},
      create: {
        id: 'demo-library-1',
        name: 'Demo TV Shows',
        type: 'tvshows',
        locations: JSON.stringify(['/media/tv']),
      },
    });

    // Seed demo series
    const demoSeries = await prisma.item.upsert({
      where: { id: 'demo-series-1' },
      update: {},
      create: {
        id: 'demo-series-1',
        name: 'Doctor Who',
        type: 'Series',
        overview: 'The adventures of a Time Lord known as the Doctor.',
        libraryId: demoLibrary.id,
        dateCreated: new Date('2023-01-01'),
        year: 2005,
        genres: JSON.stringify(['Science Fiction', 'Adventure']),
        tags: JSON.stringify(['British', 'Time Travel']),
        studios: JSON.stringify(['BBC']),
        hasArtwork: false,
      },
    });

    // Seed demo season
    const demoSeason = await prisma.item.upsert({
      where: { id: 'demo-season-1' },
      update: {},
      create: {
        id: 'demo-season-1',
        name: 'Season 1',
        type: 'Season',
        parentId: demoSeries.id,
        libraryId: demoLibrary.id,
        dateCreated: new Date('2023-01-01'),
        indexNumber: 1,
        genres: JSON.stringify([]),
        tags: JSON.stringify([]),
        studios: JSON.stringify([]),
        hasArtwork: false,
      },
    });

    // Seed demo episodes
    for (let i = 1; i <= 3; i++) {
      await prisma.item.upsert({
        where: { id: `demo-episode-${i}` },
        update: {},
        create: {
          id: `demo-episode-${i}`,
          name: `Episode ${i}`,
          type: 'Episode',
          overview: `This is episode ${i} of the series.`,
          parentId: demoSeason.id,
          libraryId: demoLibrary.id,
          dateCreated: new Date('2023-01-01'),
          indexNumber: i,
          parentIndexNumber: 1,
          runTimeTicks: BigInt(45 * 60 * 10000000), // 45 minutes in 100ns ticks
          runtimeMins: 45,
          genres: JSON.stringify([]),
          tags: JSON.stringify([]),
          studios: JSON.stringify([]),
          hasArtwork: false,
        },
      });
    }

    // Seed demo provider IDs
    await prisma.providerIdMap.upsert({
      where: {
        itemId_provider: {
          itemId: demoSeries.id,
          provider: 'tvdb',
        },
      },
      update: {},
      create: {
        itemId: demoSeries.id,
        provider: 'tvdb',
        providerId: '78804',
      },
    });

    await prisma.providerIdMap.upsert({
      where: {
        itemId_provider: {
          itemId: demoSeries.id,
          provider: 'tmdb',
        },
      },
      update: {},
      create: {
        itemId: demoSeries.id,
        provider: 'tmdb',
        providerId: '57243',
      },
    });

    // Seed demo collection
    const demoCollection = await prisma.collection.upsert({
      where: { id: 'demo-collection-1' },
      update: {},
      create: {
        id: 'demo-collection-1',
        name: 'British Sci-Fi',
        type: 'manual',
      },
    });

    await prisma.collectionItem.upsert({
      where: {
        collectionId_itemId: {
          collectionId: demoCollection.id,
          itemId: demoSeries.id,
        },
      },
      update: {},
      create: {
        collectionId: demoCollection.id,
        itemId: demoSeries.id,
        sortIndex: 1,
      },
    });

    console.log('✅ Demo data seeded');
  }

  console.log('🌟 Database seeding completed');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
