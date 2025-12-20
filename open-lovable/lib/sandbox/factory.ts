import { SandboxProvider, SandboxProviderConfig } from './types';
import { LocalProvider } from './providers/local-provider';

export class SandboxFactory {
  static create(provider?: string, config?: SandboxProviderConfig): SandboxProvider {
    // Local Sandbox is the only provider
    console.log('[SandboxFactory.create] Creating LocalProvider');
    return new LocalProvider(config || {});
  }

  static getAvailableProviders(): string[] {
    return ['local'];
  }

  static isProviderAvailable(provider: string): boolean {
    // Local provider is always available
    return provider.toLowerCase() === 'local';
  }
}