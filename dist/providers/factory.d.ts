import { ProviderName } from '../types';
import { AIProvider } from './provider';
export declare function createProvider(provider: ProviderName, apiKey: string, model?: string): AIProvider;
export declare function getDefaultModel(provider: ProviderName): string;
//# sourceMappingURL=factory.d.ts.map