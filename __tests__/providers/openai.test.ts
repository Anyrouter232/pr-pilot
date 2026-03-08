import { OpenAIProvider } from '../../src/providers/openai';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
}));

describe('OpenAIProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have name "openai"', () => {
    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    expect(provider.name).toBe('openai');
  });

  it('should parse a valid JSON response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Looks good overall.',
              files: [],
              overallSeverity: 'approve',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    const result = await provider.reviewDiff('system prompt', 'user prompt');

    expect(result.summary).toBe('Looks good overall.');
    expect(result.overallSeverity).toBe('approve');
    expect(result.files).toEqual([]);
  });

  it('should track token usage', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'OK',
              files: [],
              overallSeverity: 'approve',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    expect(provider.getLastUsage()).toBeNull();

    await provider.reviewDiff('system', 'user');

    const usage = provider.getLastUsage();
    expect(usage).toEqual({
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
    });
  });

  it('should handle response with file comments', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Found some issues.',
              files: [
                {
                  filename: 'src/app.ts',
                  comments: [
                    { line: 10, severity: 'warning', comment: 'Possible null ref' },
                    { line: 20, severity: 'suggestion', comment: 'Consider using const' },
                  ],
                  fileSummary: 'Modified app logic',
                },
              ],
              overallSeverity: 'comment',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].comments).toHaveLength(2);
    expect(result.files[0].comments[0].severity).toBe('warning');
  });

  it('should throw on empty response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('empty response');
  });

  it('should throw on invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('not valid JSON');
  });

  it('should validate and fix malformed response fields', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: null,
              files: [
                {
                  filename: 'test.ts',
                  comments: [
                    { line: -1, severity: 'warning', comment: 'bad line' },
                    { line: 5, severity: 'critical', comment: 'good comment' },
                    { line: 10, severity: 'warning', comment: null },
                  ],
                  fileSummary: 'test',
                },
              ],
              overallSeverity: 'invalid_value',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const provider = new OpenAIProvider('fake-key', 'gpt-5.4');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.summary).toBe('No summary provided.');
    expect(result.overallSeverity).toBe('comment');
    expect(result.files[0].comments).toHaveLength(1);
    expect(result.files[0].comments[0].line).toBe(5);
  });
});
