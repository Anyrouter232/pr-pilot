import { groupFiles, detectImportRelationships, isTestFile } from '../src/grouper';
import { PRFile } from '../src/types';

function makeFile(filename: string, patch?: string): PRFile {
  return {
    filename,
    status: 'modified',
    additions: 5,
    deletions: 2,
    patch: patch ?? '@@ -1,3 +1,3 @@\n line1\n-old\n+new',
  };
}

describe('groupFiles', () => {
  it('should return single group for single file', () => {
    const groups = groupFiles([makeFile('src/app.ts')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(1);
    expect(groups[0].name).toBe('src/app.ts');
    expect(groups[0].context).toContain('Single file');
  });

  it('should pair test file with implementation file', () => {
    const files = [makeFile('__tests__/parser.test.ts'), makeFile('src/parser.ts')];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].name).toContain('parser.ts');
    expect(groups[0].name).toContain('tests');
    expect(groups[0].context).toContain('Implementation file and its test suite');
  });

  it('should pair spec file with implementation file', () => {
    const files = [makeFile('src/utils.ts'), makeFile('src/utils.spec.ts')];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
  });

  it('should pair test/ directory tests', () => {
    const files = [makeFile('test/config.test.ts'), makeFile('src/config.ts')];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
  });

  it('should group unpaired files by directory', () => {
    const files = [
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('src/c.ts'),
      makeFile('lib/util.ts'),
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(2);

    const srcGroup = groups.find((g) => g.name.includes('src/'));
    expect(srcGroup).toBeDefined();
    expect(srcGroup!.files).toHaveLength(3);
    expect(srcGroup!.context).toContain('3 files');

    const libGroup = groups.find((g) => g.files[0].filename === 'lib/util.ts');
    expect(libGroup).toBeDefined();
    expect(libGroup!.files).toHaveLength(1);
  });

  it('should handle mixed scenario with pairs and ungrouped', () => {
    const files = [
      makeFile('src/parser.ts'),
      makeFile('__tests__/parser.test.ts'),
      makeFile('src/config.ts'),
      makeFile('src/main.ts'),
      makeFile('docs/api.md'),
    ];

    const groups = groupFiles(files);

    // parser pair, src/ directory group (config + main), docs single
    expect(groups).toHaveLength(3);

    const pairGroup = groups.find((g) => g.name.includes('parser.ts') && g.name.includes('tests'));
    expect(pairGroup).toBeDefined();
    expect(pairGroup!.files).toHaveLength(2);

    const srcGroup = groups.find((g) => g.name.includes('src/') && g.name.includes('2 files'));
    expect(srcGroup).toBeDefined();

    const docsGroup = groups.find((g) => g.files[0].filename === 'docs/api.md');
    expect(docsGroup).toBeDefined();
  });

  it('should not pair test file when implementation is not in the PR', () => {
    const files = [makeFile('__tests__/missing.test.ts'), makeFile('src/other.ts')];

    const groups = groupFiles(files);

    // Should be two separate groups since missing.ts doesn't exist
    expect(groups).toHaveLength(2);
  });
});

describe('detectImportRelationships', () => {
  it('should detect ES import statements', () => {
    const files = [
      makeFile('src/main.ts', "@@ -1,3 +1,3 @@\n+import { foo } from './utils';\n line2\n line3"),
      makeFile('src/utils.ts'),
    ];

    const imports = detectImportRelationships(files);

    expect(imports.has('src/main.ts')).toBe(true);
    expect(imports.get('src/main.ts')).toContain('src/utils.ts');
  });

  it('should detect require statements', () => {
    const files = [
      makeFile(
        'src/app.js',
        "@@ -1,3 +1,3 @@\n+const config = require('./config');\n line2\n line3"
      ),
      makeFile('src/config.js'),
    ];

    const imports = detectImportRelationships(files);

    expect(imports.has('src/app.js')).toBe(true);
    expect(imports.get('src/app.js')).toContain('src/config.js');
  });

  it('should ignore node_modules imports', () => {
    const files = [
      makeFile('src/app.ts', "@@ -1,3 +1,3 @@\n+import express from 'express';\n line2\n line3"),
    ];

    const imports = detectImportRelationships(files);

    expect(imports.has('src/app.ts')).toBe(false);
  });

  it('should return empty map when no imports found', () => {
    const files = [makeFile('src/app.ts', '@@ -1,3 +1,3 @@\n+const x = 1;\n line2\n line3')];

    const imports = detectImportRelationships(files);

    expect(imports.size).toBe(0);
  });

  it('should deduplicate imports', () => {
    const files = [
      makeFile(
        'src/main.ts',
        "@@ -1,4 +1,4 @@\n+import { a } from './utils';\n+import { b } from './utils';\n line3\n line4"
      ),
      makeFile('src/utils.ts'),
    ];

    const imports = detectImportRelationships(files);
    const mainImports = imports.get('src/main.ts');

    expect(mainImports).toHaveLength(1);
  });
});

describe('isTestFile', () => {
  it('should identify .test.ts files', () => {
    expect(isTestFile('__tests__/parser.test.ts')).toBe(true);
    expect(isTestFile('src/utils.test.ts')).toBe(true);
    expect(isTestFile('test/config.test.js')).toBe(true);
  });

  it('should identify .spec.ts files', () => {
    expect(isTestFile('src/app.spec.tsx')).toBe(true);
  });

  it('should not identify regular files as test files', () => {
    expect(isTestFile('src/parser.ts')).toBe(false);
    expect(isTestFile('src/test.ts')).toBe(false);
    expect(isTestFile('README.md')).toBe(false);
  });
});
