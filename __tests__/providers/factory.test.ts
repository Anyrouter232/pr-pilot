import { createProvider, getDefaultModel } from '../../src/providers/factory';
import { OpenAIProvider } from '../../src/providers/openai';
import { AnthropicProvider } from '../../src/providers/anthropic';
import { GeminiProvider } from '../../src/providers/gemini';

jest.mock('openai', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(),
  })),
}));

describe('createProvider', () => {
  it('should create OpenAIProvider for "openai"', () => {
    const provider = createProvider('openai', 'key', 'gpt-5.4');
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('should create AnthropicProvider for "anthropic"', () => {
    const provider = createProvider('anthropic', 'key', 'claude-sonnet-4-6');
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('should create GeminiProvider for "gemini"', () => {
    const provider = createProvider('gemini', 'key', 'gemini-2.0-flash');
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.name).toBe('gemini');
  });

  it('should use default model when none provided', () => {
    const provider = createProvider('openai', 'key');
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should throw for unknown provider', () => {
    expect(() => createProvider('unknown' as never, 'key')).toThrow('Unknown AI provider');
  });
});

describe('getDefaultModel', () => {
  it('should return gpt-5.4 for openai', () => {
    expect(getDefaultModel('openai')).toBe('gpt-5.4');
  });

  it('should return claude model for anthropic', () => {
    expect(getDefaultModel('anthropic')).toBe('claude-sonnet-4-6');
  });

  it('should return gemini model for gemini', () => {
    expect(getDefaultModel('gemini')).toBe('gemini-2.0-flash');
  });
});
