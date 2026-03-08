import { ResolvedConfig, PRContext, FileGroup } from './types';

export function getSystemPrompt(config: ResolvedConfig): string {
  const levelInstructions: Record<string, string> = {
    concise:
      'Be brief. Only flag genuine bugs, security issues, or clear anti-patterns. Skip style nitpicks.',
    standard:
      'Provide a balanced review. Flag bugs, security issues, performance problems, and significant code quality issues. Include suggestions for improvement.',
    thorough:
      'Provide a comprehensive review. Cover bugs, security, performance, readability, maintainability, naming conventions, documentation gaps, test coverage suggestions, and edge cases.',
  };

  let prompt = `You are PR Pilot, an expert code reviewer. You review pull request diffs and provide actionable, constructive feedback.

## Your Guidelines
- Review the code diff provided and identify issues.
- Each issue must reference a specific line number from the annotated diff (the [L<number>] markers).
- Categorize each issue with a severity: "critical", "warning", "suggestion", or "nitpick".
- Be constructive and explain WHY something is an issue, not just WHAT is wrong.
- If the code looks good, say so. Don't invent issues.
- Focus on the CHANGED lines (lines starting with +), not removed lines.
- ${levelInstructions[config.reviewLevel]}`;

  if (config.customPrompt) {
    prompt += `\n\n## Additional Instructions\n${config.customPrompt}`;
  }

  if (config.reviewRules.length > 0) {
    prompt +=
      '\n\n## Project-Specific Rules\nThe following rules are defined by the project maintainers:';
    for (const rule of config.reviewRules) {
      prompt += `\n- ${rule}`;
    }
  }

  if (Object.keys(config.languageHints).length > 0) {
    prompt += '\n\n## Language Hints';
    for (const [ext, lang] of Object.entries(config.languageHints)) {
      prompt += `\n- Files ending in \`${ext}\` are written in ${lang}`;
    }
  }

  prompt += `

## Response Format
Respond with valid JSON matching this schema:
{
  "summary": "Brief overall assessment of the PR (2-4 sentences)",
  "files": [
    {
      "filename": "path/to/file.ts",
      "comments": [
        {
          "line": 42,
          "severity": "warning",
          "comment": "Explanation of the issue and suggested fix"
        }
      ],
      "fileSummary": "Brief summary of changes in this file"
    }
  ],
  "overallSeverity": "approve" | "request_changes" | "comment"
}

If there are no issues, return an empty comments array and set overallSeverity to "approve".
IMPORTANT: Return ONLY valid JSON. No markdown code fences, no extra text.`;

  return prompt;
}

export function getUserPrompt(prContext: PRContext, annotatedDiffs: string[]): string {
  return `## Pull Request: ${prContext.title}

${prContext.body ? `### Description\n${prContext.body}\n` : ''}

### Code Changes

${annotatedDiffs.join('\n\n---\n\n')}`;
}

export function getUserPromptForGroup(
  prContext: PRContext,
  group: FileGroup,
  annotatedDiffs: string[]
): string {
  return `## Pull Request: ${prContext.title}

${prContext.body ? `### Description\n${prContext.body}\n` : ''}

### File Group: ${group.name}
${group.context}

### Code Changes

${annotatedDiffs.join('\n\n---\n\n')}`;
}
