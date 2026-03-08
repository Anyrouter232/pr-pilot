import { buildAnnotatedDiff, isLineInDiff } from '../src/parser';
import { PRFile } from '../src/types';

describe('buildAnnotatedDiff', () => {
  it('should annotate added and context lines with line numbers', () => {
    const file: PRFile = {
      filename: 'src/app.ts',
      status: 'modified',
      additions: 2,
      deletions: 1,
      patch: [
        '@@ -10,4 +10,5 @@ function hello() {',
        '   const a = 1;',
        '-  const b = 2;',
        '+  const b = 3;',
        '+  const c = 4;',
        '   return a + b;',
      ].join('\n'),
    };

    const result = buildAnnotatedDiff(file);

    expect(result).toContain('## src/app.ts (modified)');
    expect(result).toContain('[L10]    const a = 1;');
    expect(result).toContain('[L11] +  const b = 3;');
    expect(result).toContain('[L12] +  const c = 4;');
    expect(result).toContain('[L13]    return a + b;');
    // Deleted lines should NOT have line annotations
    expect(result).toContain('-  const b = 2;');
    expect(result).not.toMatch(/\[L\d+\] -/);
  });

  it('should handle files with no patch', () => {
    const file: PRFile = {
      filename: 'binary.png',
      status: 'added',
      additions: 0,
      deletions: 0,
      patch: undefined,
    };

    const result = buildAnnotatedDiff(file);
    expect(result).toBe('');
  });

  it('should handle multiple hunks', () => {
    const file: PRFile = {
      filename: 'src/utils.ts',
      status: 'modified',
      additions: 2,
      deletions: 0,
      patch: [
        '@@ -1,3 +1,4 @@ import foo',
        ' line1',
        ' line2',
        '+newline1',
        ' line3',
        '@@ -20,3 +21,4 @@ function bar() {',
        ' existing',
        '+added',
        ' more',
      ].join('\n'),
    };

    const result = buildAnnotatedDiff(file);

    expect(result).toContain('[L1]  line1');
    expect(result).toContain('[L3] +newline1');
    expect(result).toContain('[L21]  existing');
    expect(result).toContain('[L22] +added');
  });
});

describe('isLineInDiff', () => {
  const file: PRFile = {
    filename: 'test.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    patch: [
      '@@ -10,4 +10,4 @@ function test() {',
      '   const a = 1;',
      '-  const b = 2;',
      '+  const b = 3;',
      '   return a;',
    ].join('\n'),
  };

  it('should return true for lines present in the diff', () => {
    expect(isLineInDiff(file, 10)).toBe(true); // context line
    expect(isLineInDiff(file, 11)).toBe(true); // added line
    expect(isLineInDiff(file, 12)).toBe(true); // context line
  });

  it('should return false for lines not in the diff', () => {
    expect(isLineInDiff(file, 5)).toBe(false);
    expect(isLineInDiff(file, 20)).toBe(false);
    expect(isLineInDiff(file, 0)).toBe(false);
  });

  it('should return false for files with no patch', () => {
    const noPatchFile: PRFile = {
      filename: 'binary.png',
      status: 'added',
      additions: 0,
      deletions: 0,
      patch: undefined,
    };
    expect(isLineInDiff(noPatchFile, 1)).toBe(false);
  });
});
