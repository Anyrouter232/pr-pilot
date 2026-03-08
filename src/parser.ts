import { PRFile } from './types';

export function buildAnnotatedDiff(file: PRFile): string {
  if (!file.patch) return '';

  const lines = file.patch.split('\n');
  const annotated: string[] = [`## ${file.filename} (${file.status})`];
  let newLineNum = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

    if (hunkMatch) {
      newLineNum = parseInt(hunkMatch[1], 10);
      annotated.push(line);
      continue;
    }

    if (line.startsWith('+')) {
      annotated.push(`[L${newLineNum}] ${line}`);
      newLineNum++;
    } else if (line.startsWith('-')) {
      annotated.push(line);
    } else if (line.startsWith(' ')) {
      annotated.push(`[L${newLineNum}] ${line}`);
      newLineNum++;
    }
  }

  return annotated.join('\n');
}

export function isLineInDiff(file: PRFile, line: number): boolean {
  if (!file.patch) return false;

  const lines = file.patch.split('\n');
  let newLineNum = 0;

  for (const diffLine of lines) {
    const hunkMatch = diffLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLineNum = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (diffLine.startsWith('+') || diffLine.startsWith(' ')) {
      if (newLineNum === line) return true;
      newLineNum++;
    }
  }

  return false;
}
