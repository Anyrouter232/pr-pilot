import { OpenAIClient } from '../src/openai';

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

describe('OpenAIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      usage: { total_tokens: 500 },
    });

    const client = new OpenAIClient('fake-key', 'gpt-4o');
    const result = await client.reviewDiff('system prompt', 'user prompt');

    expect(result.summary).toBe('Looks good overall.');
    expect(result.overallSeverity).toBe('approve');
    expect(result.files).toEqual([]);
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
      usage: { total_tokens: 1200 },
    });

    const client = new OpenAIClient('fake-key', 'gpt-4o');
    const result = await client.reviewDiff('system', 'user');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].comments).toHaveLength(2);
    expect(result.files[0].comments[0].severity).toBe('warning');
  });

  it('should throw on empty response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { total_tokens: 0 },
    });

    const client = new OpenAIClient('fake-key', 'gpt-4o');
    await expect(client.reviewDiff('system', 'user')).rejects.toThrow('empty response');
  });

  it('should throw on invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
      usage: { total_tokens: 100 },
    });

    const client = new OpenAIClient('fake-key', 'gpt-4o');
    await expect(client.reviewDiff('system', 'user')).rejects.toThrow('not valid JSON');
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
      usage: { total_tokens: 300 },
    });

    const client = new OpenAIClient('fake-key', 'gpt-4o');
    const result = await client.reviewDiff('system', 'user');

    expect(result.summary).toBe('No summary provided.');
    expect(result.overallSeverity).toBe('comment');
    // Only the comment with valid line (5) and valid string comment should remain
    expect(result.files[0].comments).toHaveLength(1);
    expect(result.files[0].comments[0].line).toBe(5);
  });
});
