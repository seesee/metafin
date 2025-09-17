import { Injectable } from '@nestjs/common';
import { LoggerService } from '../modules/logger/logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AppError } from '@metafin/shared';

export interface MisclassificationReason {
  type:
    | 'naming_pattern'
    | 'path_structure'
    | 'metadata_inconsistency'
    | 'duration_anomaly'
    | 'missing_seasons';
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number; // 0.0 to 1.0
}

export interface MisclassificationAnalysis {
  itemId: string;
  currentType: string;
  suggestedType?: string;
  score: number; // 0.0 to 1.0, higher = more likely misclassified
  reasons: MisclassificationReason[];
  needsReview: boolean;
}

export interface MisclassificationScanResult {
  totalItems: number;
  itemsScanned: number;
  misclassifiedItems: number;
  highConfidenceIssues: number;
  mediumConfidenceIssues: number;
  lowConfidenceIssues: number;
  duration: number;
}

@Injectable()
export class MisclassificationService {
  constructor(
    private readonly logger: LoggerService,
    private readonly database: DatabaseService
  ) {}

  async analyzeItem(itemId: string): Promise<MisclassificationAnalysis> {
    const item = await this.database.item.findUnique({
      where: { id: itemId },
      include: {
        children: {
          select: { id: true, type: true, name: true, indexNumber: true },
        },
        parent: {
          select: { id: true, type: true, name: true },
        },
      },
    });

    if (!item) {
      throw AppError.notFound(`Item not found: ${itemId}`);
    }

    const reasons: MisclassificationReason[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Analyze naming patterns
    const namingAnalysis = this.analyzeNamingPatterns(item);
    if (namingAnalysis) {
      reasons.push(namingAnalysis);
      totalScore +=
        namingAnalysis.confidence *
        this.getSeverityWeight(namingAnalysis.severity);
    }
    maxScore += this.getSeverityWeight('high');

    // Analyze path structure
    const pathAnalysis = this.analyzePathStructure(item);
    if (pathAnalysis) {
      reasons.push(pathAnalysis);
      totalScore +=
        pathAnalysis.confidence * this.getSeverityWeight(pathAnalysis.severity);
    }
    maxScore += this.getSeverityWeight('high');

    // Analyze metadata consistency
    const metadataAnalysis = this.analyzeMetadataConsistency(item);
    if (metadataAnalysis) {
      reasons.push(metadataAnalysis);
      totalScore +=
        metadataAnalysis.confidence *
        this.getSeverityWeight(metadataAnalysis.severity);
    }
    maxScore += this.getSeverityWeight('medium');

    // Analyze duration anomalies (for episodes/movies)
    const durationAnalysis = this.analyzeDurationAnomalies(item);
    if (durationAnalysis) {
      reasons.push(durationAnalysis);
      totalScore +=
        durationAnalysis.confidence *
        this.getSeverityWeight(durationAnalysis.severity);
    }
    maxScore += this.getSeverityWeight('medium');

    // Analyze missing seasons (for series)
    const seasonAnalysis = this.analyzeMissingSeasons(item);
    if (seasonAnalysis) {
      reasons.push(seasonAnalysis);
      totalScore +=
        seasonAnalysis.confidence *
        this.getSeverityWeight(seasonAnalysis.severity);
    }
    maxScore += this.getSeverityWeight('low');

    const finalScore = maxScore > 0 ? totalScore / maxScore : 0;
    const suggestedType = this.determineSuggestedType(item, reasons);

    return {
      itemId,
      currentType: item.type,
      suggestedType,
      score: finalScore,
      reasons,
      needsReview:
        finalScore > 0.6 || reasons.some((r) => r.severity === 'high'),
    };
  }

  async scanLibraryForMisclassifications(
    libraryId?: string,
    itemTypes?: string[]
  ): Promise<MisclassificationScanResult> {
    const startTime = Date.now();

    const whereClause: Record<string, unknown> = {};
    if (libraryId) {
      whereClause.libraryId = libraryId;
    }
    if (itemTypes) {
      whereClause.type = { in: itemTypes };
    }

    const totalItems = await this.database.item.count({ where: whereClause });

    let itemsScanned = 0;
    let misclassifiedItems = 0;
    let highConfidenceIssues = 0;
    let mediumConfidenceIssues = 0;
    let lowConfidenceIssues = 0;

    const batchSize = 50;
    let skip = 0;

    // Process items in batches
    while (skip < totalItems) {
      const items = await this.database.item.findMany({
        where: whereClause,
        skip,
        take: batchSize,
        include: {
          children: {
            select: { id: true, type: true, name: true, indexNumber: true },
          },
          parent: {
            select: { id: true, type: true, name: true },
          },
        },
      });

      for (const item of items) {
        try {
          const analysis = await this.analyzeItem(item.id);
          itemsScanned++;

          if (analysis.needsReview || analysis.score > 0.5) {
            misclassifiedItems++;

            // Update item in database
            await this.database.item.update({
              where: { id: item.id },
              data: {
                suspectedMisclassification: true,
                misclassificationScore: analysis.score,
                misclassificationReasons: JSON.stringify(analysis.reasons),
              },
            });

            // Count by confidence level
            const maxSeverity = this.getMaxSeverity(analysis.reasons);
            switch (maxSeverity) {
              case 'high':
                highConfidenceIssues++;
                break;
              case 'medium':
                mediumConfidenceIssues++;
                break;
              case 'low':
                lowConfidenceIssues++;
                break;
            }
          } else {
            // Clear any previous misclassification flags if the item now looks fine
            if (item.suspectedMisclassification) {
              await this.database.item.update({
                where: { id: item.id },
                data: {
                  suspectedMisclassification: false,
                  misclassificationScore: null,
                  misclassificationReasons: null,
                },
              });
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to analyze item ${item.id}: ${error}`,
            'MisclassificationService'
          );
        }
      }

      skip += batchSize;
    }

    const duration = Date.now() - startTime;

    this.logger.log(
      `Misclassification scan completed: ${misclassifiedItems}/${itemsScanned} items flagged (${duration}ms)`,
      'MisclassificationService'
    );

    return {
      totalItems,
      itemsScanned,
      misclassifiedItems,
      highConfidenceIssues,
      mediumConfidenceIssues,
      lowConfidenceIssues,
      duration,
    };
  }

  private analyzeNamingPatterns(item: {
    name: string;
    type: string;
  }): MisclassificationReason | null {
    const name = item.name.toLowerCase();

    // Check for episode patterns in non-episode items
    if (item.type !== 'Episode') {
      const episodePatterns = [
        /s\d+e\d+/i, // S01E01
        /\d+x\d+/i, // 1x01
        /episode \d+/i, // Episode 1
        /ep\d+/i, // Ep1
        /\d{1,2}-\d{1,2}/i, // 1-01
      ];

      for (const pattern of episodePatterns) {
        if (pattern.test(name)) {
          return {
            type: 'naming_pattern',
            description: `Item named like an episode but classified as ${item.type}`,
            severity: 'high',
            confidence: 0.8,
          };
        }
      }
    }

    // Check for season patterns in non-season items
    if (item.type !== 'Season') {
      const seasonPatterns = [/^season \d+$/i, /^s\d+$/i, /^series \d+$/i];

      for (const pattern of seasonPatterns) {
        if (pattern.test(name)) {
          return {
            type: 'naming_pattern',
            description: `Item named like a season but classified as ${item.type}`,
            severity: 'high',
            confidence: 0.9,
          };
        }
      }
    }

    // Check for movie patterns in TV content
    if (item.type === 'Episode' || item.type === 'Season') {
      const moviePatterns = [
        /\(\d{4}\)$/, // Movie (2023)
        /\d{4}$/, // Movie 2023
        /BluRay|BRRip|DVDRip|WEBRip/i,
      ];

      for (const pattern of moviePatterns) {
        if (pattern.test(name)) {
          return {
            type: 'naming_pattern',
            description: `TV content with movie-like naming`,
            severity: 'medium',
            confidence: 0.6,
          };
        }
      }
    }

    return null;
  }

  private analyzePathStructure(item: {
    path?: string | null;
    type: string;
  }): MisclassificationReason | null {
    if (!item.path) return null;

    const pathParts = item.path.split(/[/\\]/);
    const pathStructure = pathParts.slice(-3).join('/'); // Last 3 parts

    // Episodes should typically be in Show/Season/Episode structure
    if (item.type === 'Episode') {
      if (pathParts.length < 3) {
        return {
          type: 'path_structure',
          description: 'Episode not in expected Show/Season/Episode structure',
          severity: 'medium',
          confidence: 0.7,
        };
      }
    }

    // Movies in TV show directory structure
    if (item.type === 'Movie') {
      const tvIndicators = [
        'season',
        'series',
        's01',
        's02',
        's03',
        's04',
        's05',
      ];
      if (
        tvIndicators.some((indicator) =>
          pathStructure.toLowerCase().includes(indicator)
        )
      ) {
        return {
          type: 'path_structure',
          description: 'Movie in TV show directory structure',
          severity: 'medium',
          confidence: 0.8,
        };
      }
    }

    return null;
  }

  private analyzeMetadataConsistency(item: {
    type: string;
    children?: Array<{ type: string }>;
  }): MisclassificationReason | null {
    // Check if series has episodes but no seasons
    if (item.type === 'Series' && item.children && item.children.length > 0) {
      const hasEpisodes = item.children.some(
        (child) => child.type === 'Episode'
      );
      const hasSeasons = item.children.some((child) => child.type === 'Season');

      if (hasEpisodes && !hasSeasons) {
        return {
          type: 'metadata_inconsistency',
          description: 'Series has episodes but no seasons',
          severity: 'medium',
          confidence: 0.7,
        };
      }
    }

    // Check if season has no episodes
    if (item.type === 'Season' && item.children?.length === 0) {
      return {
        type: 'metadata_inconsistency',
        description: 'Season with no episodes',
        severity: 'low',
        confidence: 0.5,
      };
    }

    return null;
  }

  private analyzeDurationAnomalies(item: {
    runtimeMins?: number | null;
    type: string;
  }): MisclassificationReason | null {
    if (!item.runtimeMins) return null;

    // Episodes that are too long (likely movies)
    if (item.type === 'Episode' && item.runtimeMins > 120) {
      return {
        type: 'duration_anomaly',
        description: `Episode unusually long (${item.runtimeMins} minutes)`,
        severity: 'medium',
        confidence: 0.6,
      };
    }

    // Movies that are too short (likely episodes)
    if (item.type === 'Movie' && item.runtimeMins < 60) {
      return {
        type: 'duration_anomaly',
        description: `Movie unusually short (${item.runtimeMins} minutes)`,
        severity: 'medium',
        confidence: 0.7,
      };
    }

    return null;
  }

  private analyzeMissingSeasons(item: {
    type: string;
    children?: Array<{ type: string; indexNumber?: number | null }>;
  }): MisclassificationReason | null {
    if (item.type !== 'Series' || !item.children?.length) return null;

    const seasons = item.children
      .filter((child) => child.type === 'Season')
      .map((season) => season.indexNumber)
      .filter((num): num is number => num != null)
      .sort((a, b) => a - b);

    if (seasons.length > 1) {
      // Check for gaps in season numbering
      for (let i = 1; i < seasons.length; i++) {
        if (seasons[i] - seasons[i - 1] > 1) {
          return {
            type: 'missing_seasons',
            description: `Missing seasons between ${seasons[i - 1]} and ${seasons[i]}`,
            severity: 'low',
            confidence: 0.4,
          };
        }
      }
    }

    return null;
  }

  private determineSuggestedType(
    item: { type: string },
    reasons: MisclassificationReason[]
  ): string | undefined {
    const namingReasons = reasons.filter((r) => r.type === 'naming_pattern');

    for (const reason of namingReasons) {
      if (reason.description.includes('episode') && item.type !== 'Episode') {
        return 'Episode';
      }
      if (reason.description.includes('season') && item.type !== 'Season') {
        return 'Season';
      }
      if (reason.description.includes('movie') && item.type !== 'Movie') {
        return 'Movie';
      }
    }

    const durationReasons = reasons.filter(
      (r) => r.type === 'duration_anomaly'
    );
    for (const reason of durationReasons) {
      if (reason.description.includes('Episode unusually long')) {
        return 'Movie';
      }
      if (reason.description.includes('Movie unusually short')) {
        return 'Episode';
      }
    }

    return undefined;
  }

  private getSeverityWeight(severity: 'low' | 'medium' | 'high'): number {
    switch (severity) {
      case 'low':
        return 0.3;
      case 'medium':
        return 0.6;
      case 'high':
        return 1.0;
    }
  }

  private getMaxSeverity(
    reasons: MisclassificationReason[]
  ): 'low' | 'medium' | 'high' {
    if (reasons.some((r) => r.severity === 'high')) return 'high';
    if (reasons.some((r) => r.severity === 'medium')) return 'medium';
    return 'low';
  }

  async getMisclassifiedItems(
    libraryId?: string,
    severityFilter?: 'low' | 'medium' | 'high',
    limit = 50,
    offset = 0
  ) {
    const whereClause: Record<string, unknown> = {
      suspectedMisclassification: true,
    };

    if (libraryId) {
      whereClause.libraryId = libraryId;
    }

    const items = await this.database.item.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      include: {
        library: {
          select: { name: true },
        },
      },
      orderBy: {
        misclassificationScore: 'desc',
      },
    });

    const results = items.map((item) => ({
      id: item.id,
      jellyfinId: item.jellyfinId,
      name: item.name,
      type: item.type,
      library: item.library.name,
      path: item.path,
      misclassificationScore: item.misclassificationScore,
      reasons: item.misclassificationReasons
        ? JSON.parse(item.misclassificationReasons)
        : [],
    }));

    // Filter by severity if specified
    if (severityFilter) {
      return results.filter((item) =>
        item.reasons.some(
          (r: MisclassificationReason) => r.severity === severityFilter
        )
      );
    }

    return results;
  }

  async dismissMisclassification(itemId: string): Promise<void> {
    await this.database.item.update({
      where: { id: itemId },
      data: {
        suspectedMisclassification: false,
        misclassificationScore: null,
        misclassificationReasons: null,
      },
    });

    this.logger.log(
      `Dismissed misclassification for item ${itemId}`,
      'MisclassificationService'
    );
  }
}
