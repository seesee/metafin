import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module.js';
import { LoggerModule } from '../modules/logger/logger.module.js';
import { ConfigService } from '../modules/config/config.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';
import { ProviderController } from './provider.controller.js';
import { TVMazeProvider } from './tvmaze/tvmaze.provider.js';
import { WikidataProvider } from './wikidata/wikidata.provider.js';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [ProviderRegistryService],
  controllers: [ProviderController],
  exports: [ProviderRegistryService],
})
export class ProviderModule implements OnModuleInit {
  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const configs = this.config.getProviderConfigs();

    // Initialize TVMaze provider
    if (configs.tvmaze.enabled) {
      const tvmazeProvider = new TVMazeProvider(configs.tvmaze);
      this.providerRegistry.registerProvider(tvmazeProvider);
    }

    // Initialize Wikidata provider
    if (configs.wikidata.enabled) {
      const wikidataProvider = new WikidataProvider(configs.wikidata);
      this.providerRegistry.registerProvider(wikidataProvider);
    }

    // TODO: Initialize TMDb provider when implemented
  }
}
