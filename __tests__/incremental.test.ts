import { buildShaMarker, extractShaFromMarker } from '../src/incremental';

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

describe('buildShaMarker', () => {
  it('should produce an HTML comment with the SHA', () => {
    const sha = 'abc123def456abc123def456abc123def456abc1';
    const marker = buildShaMarker(sha);

    expect(marker).toBe(`<!-- pr-pilot-head-sha:${sha} -->`);
  });

  it('should produce markers that extractShaFromMarker can parse', () => {
    const sha = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const marker = buildShaMarker(sha);
    const extracted = extractShaFromMarker(marker);

    expect(extracted).toBe(sha);
  });
});

describe('extractShaFromMarker', () => {
  it('should extract SHA from valid marker', () => {
    const text =
      'Some review body\n\n<!-- pr-pilot-head-sha:abc123def456abc123def456abc123def456abc1 -->';
    const sha = extractShaFromMarker(text);

    expect(sha).toBe('abc123def456abc123def456abc123def456abc1');
  });

  it('should return null when no marker found', () => {
    const text = 'Just a regular review comment with no marker.';
    const sha = extractShaFromMarker(text);

    expect(sha).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractShaFromMarker('')).toBeNull();
  });

  it('should return null for partial/malformed markers', () => {
    expect(extractShaFromMarker('<!-- pr-pilot-head-sha:short -->')).toBeNull();
    expect(extractShaFromMarker('<!-- pr-pilot-head-sha: -->')).toBeNull();
    expect(extractShaFromMarker('pr-pilot-head-sha:abc123')).toBeNull();
  });

  it('should extract the first SHA if multiple markers exist', () => {
    const text = [
      '<!-- pr-pilot-head-sha:1111111111111111111111111111111111111111 -->',
      '<!-- pr-pilot-head-sha:2222222222222222222222222222222222222222 -->',
    ].join('\n');

    const sha = extractShaFromMarker(text);
    expect(sha).toBe('1111111111111111111111111111111111111111');
  });
});
