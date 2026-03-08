import * as path from 'path';
import { PRFile, FileGroup } from './types';

interface TestPattern {
  testRe: RegExp;
  implPath: (match: RegExpMatchArray) => string;
}

const TEST_PATTERNS: TestPattern[] = [
  // __tests__/foo.test.ts -> src/foo.ts
  {
    testRe: /^(.+\/)?__tests__\/(.+)\.(test|spec)\.(ts|tsx|js|jsx)$/,
    implPath: (m) => `${m[1] || ''}src/${m[2]}.${m[4]}`,
  },
  // test/foo.test.ts -> src/foo.ts
  {
    testRe: /^(.+\/)?test\/(.+)\.(test|spec)\.(ts|tsx|js|jsx)$/,
    implPath: (m) => `${m[1] || ''}src/${m[2]}.${m[4]}`,
  },
  // foo.test.ts -> foo.ts (same directory)
  {
    testRe: /^(.+\/)?(.+)\.(test|spec)\.(ts|tsx|js|jsx)$/,
    implPath: (m) => `${m[1] || ''}${m[2]}.${m[4]}`,
  },
];

export function groupFiles(files: PRFile[]): FileGroup[] {
  if (files.length <= 1) {
    return files.map((f) => ({
      name: f.filename,
      files: [f],
      context: 'Single file change.',
    }));
  }

  const fileMap = new Map<string, PRFile>(files.map((f) => [f.filename, f]));
  const assigned = new Set<string>();
  const groups: FileGroup[] = [];

  // Phase 1: Pair test files with implementation files
  for (const file of files) {
    if (assigned.has(file.filename)) continue;

    for (const pattern of TEST_PATTERNS) {
      const match = file.filename.match(pattern.testRe);
      if (!match) continue;

      const implName = pattern.implPath(match);
      const implFile = fileMap.get(implName);
      if (implFile && !assigned.has(implName)) {
        groups.push({
          name: `${path.basename(implName)} + tests`,
          files: [implFile, file],
          context: 'Implementation file and its test suite, reviewed together for consistency.',
        });
        assigned.add(file.filename);
        assigned.add(implName);
        break;
      }
    }
  }

  // Phase 2: Group remaining files by directory
  const byDir = new Map<string, PRFile[]>();
  for (const file of files) {
    if (assigned.has(file.filename)) continue;
    const dir = path.dirname(file.filename);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(file);
    assigned.add(file.filename);
  }

  for (const [dir, dirFiles] of byDir) {
    if (dirFiles.length === 1) {
      groups.push({
        name: dirFiles[0].filename,
        files: dirFiles,
        context: 'Single file change.',
      });
    } else {
      groups.push({
        name: `${dir}/ (${dirFiles.length} files)`,
        files: dirFiles,
        context: `${dirFiles.length} files in the same directory, likely related to the same module.`,
      });
    }
  }

  return groups;
}

export function detectImportRelationships(files: PRFile[]): Map<string, string[]> {
  const fileSet = new Set(files.map((f) => f.filename));
  const imports = new Map<string, string[]>();

  const importRe =
    /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  for (const file of files) {
    if (!file.patch) continue;
    const found: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = importRe.exec(file.patch)) !== null) {
      const importPath = match[1] || match[2];
      if (!importPath.startsWith('.')) continue;

      const dir = path.dirname(file.filename);
      const resolved = path.normalize(path.join(dir, importPath));

      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
        const candidate = resolved + ext;
        if (fileSet.has(candidate)) {
          found.push(candidate);
          break;
        }
        const indexCandidate = path.join(resolved, `index${ext}`);
        if (fileSet.has(indexCandidate)) {
          found.push(indexCandidate);
          break;
        }
      }
    }

    if (found.length > 0) {
      imports.set(file.filename, [...new Set(found)]);
    }
  }

  return imports;
}

export function isTestFile(filename: string): boolean {
  return TEST_PATTERNS.some((p) => p.testRe.test(filename));
}
