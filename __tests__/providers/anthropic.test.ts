import { AnthropicProvider } from '../../src/providers/anthropic';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
}));

describe('AnthropicProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have name "anthropic"', () => {
    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    expect(provider.name).toBe('anthropic');
  });

  it('should parse a valid JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Code looks clean.',
            files: [],
            overallSeverity: 'approve',
          }),
        },
      ],
      usage: { input_tokens: 150, output_tokens: 80 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    const result = await provider.reviewDiff('system prompt', 'user prompt');

    expect(result.summary).toBe('Code looks clean.');
    expect(result.overallSeverity).toBe('approve');
    expect(result.files).toEqual([]);
  });

  it('should track token usage', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'OK',
            files: [],
            overallSeverity: 'approve',
          }),
        },
      ],
      usage: { input_tokens: 300, output_tokens: 150 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    expect(provider.getLastUsage()).toBeNull();

    await provider.reviewDiff('system', 'user');

    const usage = provider.getLastUsage();
    expect(usage).toEqual({
      promptTokens: 300,
      completionTokens: 150,
      totalTokens: 450,
    });
  });

  it('should strip markdown fences before parsing', async () => {
    const jsonBody = JSON.stringify({
      summary: 'Fenced response.',
      files: [],
      overallSeverity: 'comment',
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + jsonBody + '\n```' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.summary).toBe('Fenced response.');
  });

  it('should handle response with file comments', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Issues found.',
            files: [
              {
                filename: 'src/utils.ts',
                comments: [
                  { line: 5, severity: 'critical', comment: 'SQL injection risk' },
                  { line: 15, severity: 'nitpick', comment: 'Use camelCase' },
                ],
                fileSummary: 'Utility functions',
              },
            ],
            overallSeverity: 'request_changes',
          }),
        },
      ],
      usage: { input_tokens: 400, output_tokens: 200 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].comments).toHaveLength(2);
    expect(result.overallSeverity).toBe('request_changes');
  });

  it('should throw on empty response', async () => {
    mockCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('empty response');
  });

  it('should throw on invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is my review: the code looks fine.' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('not valid JSON');
  });

  it('should validate and fix malformed response fields', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 42,
            files: 'not an array',
            overallSeverity: 'unknown',
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const provider = new AnthropicProvider('fake-key', 'claude-sonnet-4-6');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.summary).toBe('No summary provided.');
    expect(result.files).toEqual([]);
    expect(result.overallSeverity).toBe('comment');
  });
});
