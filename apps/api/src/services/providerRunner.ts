import { SimulatorProvider } from '../providers/simulator.js';
import type {
  MeetProvider,
  ProviderName,
  ProviderServices,
  ProviderStatus,
} from '../providers/types.js';

/**
 * Creates a provider by name. The rest of the system never knows which
 * provider is running — everything goes through MeetProvider.
 */
export function createProvider(name: ProviderName): MeetProvider {
  switch (name) {
    case 'simulator':
      return new SimulatorProvider();
    case 'google':
      // Wired in the google provider milestone; fails loudly until configured.
      throw new Error(
        'google provider requires Google OAuth configuration (see docs/GOOGLE_SETUP.md)',
      );
    case 'csv':
      throw new Error('csv provider is driven by uploads via POST /api/import/attendance');
  }
}

/**
 * Runs the configured provider, supports runtime switching from the settings
 * page, and records provider status for the UI.
 */
export class ProviderRunner {
  private provider: MeetProvider | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly services: ProviderServices,
    private configuredName: ProviderName,
  ) {}

  currentName(): ProviderName | null {
    return this.provider?.name ?? null;
  }

  async start(): Promise<void> {
    await this.startProvider(this.configuredName);
  }

  async switchTo(name: ProviderName): Promise<void> {
    await this.stop();
    this.configuredName = name;
    await this.startProvider(name);
  }

  async stop(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.stop();
      } catch (err) {
        this.services.logger.error({ err }, 'runner: provider stop failed');
      }
      this.provider = null;
    }
  }

  status(): ProviderStatus {
    if (this.provider) return this.provider.status();
    return {
      state: 'error',
      message: this.lastError ?? 'no provider running',
      updatedAt: new Date().toISOString(),
    };
  }

  private async startProvider(name: ProviderName): Promise<void> {
    this.lastError = null;
    try {
      const provider = createProvider(name);
      this.provider = provider;
      await provider.start(this.services);
      this.services.logger.info(
        { provider: name, status: provider.status() },
        'runner: provider started',
      );
      this.services.hub.publish('provider', { name, status: provider.status() });
    } catch (err) {
      this.provider = null;
      this.lastError = err instanceof Error ? err.message : String(err);
      this.services.logger.error({ err, provider: name }, 'runner: provider failed to start');
      this.services.hub.publish('provider', { name, status: this.status() });
    }
  }
}
