import { ProviderName } from '../types';
import { AIProvider } from './provider';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.0-flash',
};

export function createProvider(provider: ProviderName, apiKey: string, model?: string): AIProvider {
  const resolvedModel = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, resolvedModel);
    case 'anthropic':
      return new AnthropicProvider(apiKey, resolvedModel);
    case 'gemini':
      return new GeminiProvider(apiKey, resolvedModel);
    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Supported providers: openai, anthropic, gemini.`
      );
  }
}

export function getDefaultModel(provider: ProviderName): string {
  return DEFAULT_MODELS[provider];
}
