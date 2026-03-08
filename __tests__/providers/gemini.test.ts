import { GeminiProvider } from '../../src/providers/gemini';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
}));

function mockGeminiResponse(text: string, tokens = { prompt: 100, completion: 50, total: 150 }) {
  return {
    response: {
      text: () => text,
      usageMetadata: {
        promptTokenCount: tokens.prompt,
        candidatesTokenCount: tokens.completion,
        totalTokenCount: tokens.total,
      },
    },
  };
}

describe('GeminiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have name "gemini"', () => {
    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    expect(provider.name).toBe('gemini');
  });

  it('should parse a valid JSON response', async () => {
    mockGenerateContent.mockResolvedValue(
      mockGeminiResponse(
        JSON.stringify({
          summary: 'Clean code.',
          files: [],
          overallSeverity: 'approve',
        })
      )
    );

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    const result = await provider.reviewDiff('system prompt', 'user prompt');

    expect(result.summary).toBe('Clean code.');
    expect(result.overallSeverity).toBe('approve');
    expect(result.files).toEqual([]);
  });

  it('should track token usage', async () => {
    mockGenerateContent.mockResolvedValue(
      mockGeminiResponse(JSON.stringify({ summary: 'OK', files: [], overallSeverity: 'approve' }), {
        prompt: 250,
        completion: 120,
        total: 370,
      })
    );

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    expect(provider.getLastUsage()).toBeNull();

    await provider.reviewDiff('system', 'user');

    const usage = provider.getLastUsage();
    expect(usage).toEqual({
      promptTokens: 250,
      completionTokens: 120,
      totalTokens: 370,
    });
  });

  it('should handle response with file comments', async () => {
    mockGenerateContent.mockResolvedValue(
      mockGeminiResponse(
        JSON.stringify({
          summary: 'Some issues.',
          files: [
            {
              filename: 'src/index.ts',
              comments: [
                { line: 3, severity: 'warning', comment: 'Unused import' },
                { line: 10, severity: 'suggestion', comment: 'Add error handling' },
              ],
              fileSummary: 'Entry point',
            },
          ],
          overallSeverity: 'comment',
        })
      )
    );

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].comments).toHaveLength(2);
  });

  it('should throw on empty response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
      },
    });

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('empty response');
  });

  it('should throw on invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse('This is not JSON at all.'));

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    await expect(provider.reviewDiff('system', 'user')).rejects.toThrow('not valid JSON');
  });

  it('should validate and fix malformed response fields', async () => {
    mockGenerateContent.mockResolvedValue(
      mockGeminiResponse(
        JSON.stringify({
          summary: false,
          files: [
            {
              filename: 'test.ts',
              comments: [
                { line: 0, severity: 'critical', comment: 'zero line' },
                { line: 8, severity: 'warning', comment: 'valid' },
              ],
              fileSummary: 'test',
            },
          ],
          overallSeverity: 'bogus',
        })
      )
    );

    const provider = new GeminiProvider('fake-key', 'gemini-2.0-flash');
    const result = await provider.reviewDiff('system', 'user');

    expect(result.summary).toBe('No summary provided.');
    expect(result.overallSeverity).toBe('comment');
    expect(result.files[0].comments).toHaveLength(1);
    expect(result.files[0].comments[0].line).toBe(8);
  });
});
