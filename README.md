# PR Pilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered pull request reviewer that supports **OpenAI**, **Anthropic Claude**, and **Google Gemini**. Get instant, actionable code review feedback on every PR.

## Features

- **Multi-provider support** — OpenAI (GPT-5.4), Anthropic (Claude), and Google Gemini
- **Automatic code review** on every pull request
- **Inline comments** on specific lines with severity levels (critical / warning / suggestion / nitpick)
- **Incremental reviews** — on new pushes, only reviews the new changes
- **Smart file grouping** — groups related files (implementation + tests) for better context
- **Review analytics** — collapsible stats section with token usage, severity breakdown, and hotspot files
- **Repo-level config** — `.pr-pilot.yml` for project-specific settings and review rules
- **Configurable review depth** — concise, standard, or thorough
- **Smart file filtering** — skip lock files, generated code, and binaries
- **Custom review instructions** — via prompts or project-specific rules
- **CI gating** — optionally fail the workflow if critical issues are found

## Quick Start

1. Add your API key as a repository secret (e.g., `OPENAI_API_KEY`)
2. Create `.github/workflows/pr-review.yml` in your repository:

```yaml
name: PR Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Anyrouter232/pr-pilot@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

That's it. Every PR will now get an AI-powered code review.

## Multi-Provider Support

PR Pilot supports three AI providers. Set the `provider` input and the corresponding API key:

### OpenAI (default)

```yaml
- uses: Anyrouter232/pr-pilot@v1
  with:
    provider: openai
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-5.4  # optional, this is the default
```

### Anthropic Claude

```yaml
- uses: Anyrouter232/pr-pilot@v1
  with:
    provider: anthropic
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: claude-sonnet-4-6  # optional, this is the default
```

### Google Gemini

```yaml
- uses: Anyrouter232/pr-pilot@v1
  with:
    provider: gemini
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    model: gemini-2.0-flash  # optional, this is the default
```

## Configuration

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for API access | `${{ github.token }}` |
| `provider` | AI provider: `openai`, `anthropic`, or `gemini` | `openai` |
| `openai-api-key` | OpenAI API key | `""` |
| `anthropic-api-key` | Anthropic API key | `""` |
| `gemini-api-key` | Google Gemini API key | `""` |
| `model` | AI model to use | Provider default |
| `max-files` | Max files to review (0 = unlimited) | `20` |
| `exclude-patterns` | Comma-separated glob patterns to skip | `*.lock,package-lock.json,...` |
| `review-level` | Review depth: `concise`, `standard`, `thorough` | `standard` |
| `custom-prompt` | Additional review instructions | `""` |
| `post-summary` | Post a summary comment | `true` |
| `fail-on-issues` | Fail the action if issues found | `false` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `review-comment-id` | ID of the posted review |
| `issues-found` | Number of issues found |
| `files-reviewed` | Number of files reviewed |
| `tokens-used` | Total tokens consumed |
| `review-duration-ms` | Review duration in milliseconds |
| `provider` | AI provider used |

### Repo Config File (`.pr-pilot.yml`)

Create a `.pr-pilot.yml` file in your repo root for project-specific settings:

```yaml
# AI provider and model (overridden by action inputs if set)
provider: openai
model: gpt-5.4

# Review behavior
review_level: thorough
max_files: 30
auto_approve: true  # Auto-approve if no issues found

# File filtering
exclude_patterns:
  - "*.lock"
  - "dist/**"
  - "*.generated.ts"
ignore_paths:
  - "vendor/**"
  - "third_party/**"

# Comment filtering
severity_threshold: suggestion  # Only post suggestion, warning, critical (skip nitpick)
max_comment_length: 500         # Truncate long comments

# Project-specific review rules
review_rules:
  - "No console.log statements in production code"
  - "All exported functions must have JSDoc comments"
  - "Prefer const over let where possible"
  - "All API endpoints must validate input"

# Language hints for uncommon file extensions
language_hints:
  ".tsx": "React TypeScript"
  ".prisma": "Prisma Schema"
  ".sol": "Solidity"
```

Action inputs always override `.pr-pilot.yml` settings.

## How It Works

1. Triggered on `pull_request` events (opened or updated)
2. Loads optional `.pr-pilot.yml` config from the repo
3. On `synchronize` events, checks for previous reviews and only reviews new changes
4. Fetches changed files, filters excluded patterns, and groups related files
5. Sends annotated diffs to the AI provider with structured review prompts
6. Parses the AI response and validates line numbers against the actual diff
7. Posts a single review with inline comments, summary, and analytics

## Incremental Reviews

When new commits are pushed to an existing PR, PR Pilot performs an **incremental review** — only analyzing the changes since the last review. This saves tokens and provides focused feedback on what's new.

The system tracks the last-reviewed commit SHA using a hidden marker in the review body. If no previous review is found, it falls back to a full review.

## Smart File Grouping

For PRs with more than 5 files, PR Pilot groups related files together:

- **Test pairing** — `src/parser.ts` and `__tests__/parser.test.ts` are reviewed together
- **Directory grouping** — files in the same directory are batched for context
- **Single files** — standalone changes are reviewed individually

This gives the AI better context for understanding code relationships.

## Review Severity Levels

| Level | Emoji | Meaning |
|-------|-------|---------|
| Critical | 🔴 | Bugs, security vulnerabilities, data loss risks |
| Warning | 🟡 | Performance issues, potential bugs, anti-patterns |
| Suggestion | 🔵 | Improvements, better approaches, readability |
| Nitpick | ⚪ | Style, naming, minor preferences |

## Advanced Example

```yaml
- uses: Anyrouter232/pr-pilot@v1
  with:
    provider: anthropic
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: claude-sonnet-4-6
    review-level: thorough
    max-files: 30
    exclude-patterns: '*.lock,dist/**,*.generated.ts,docs/**'
    custom-prompt: 'Focus on security vulnerabilities and SQL injection risks.'
    fail-on-issues: true
```

## Setting Up API Keys

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Add it as a repo secret: **Settings > Secrets > Actions > `OPENAI_API_KEY`**

### Anthropic

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Add it as a repo secret: `ANTHROPIC_API_KEY`

### Google Gemini

1. Get an API key from [aistudio.google.com](https://aistudio.google.com/apikey)
2. Add it as a repo secret: `GEMINI_API_KEY`

## Architecture

```
PR Event
  └─> main.ts
       ├─> config.ts (read action inputs)
       ├─> repo-config.ts (load .pr-pilot.yml, merge configs)
       ├─> incremental.ts (check for previous reviews)
       ├─> review.ts (orchestrate)
       │    ├─> grouper.ts (smart file grouping)
       │    ├─> parser.ts (annotate diffs with line numbers)
       │    ├─> prompts.ts (build AI prompts)
       │    ├─> providers/ (multi-provider AI clients)
       │    │    ├─> openai.ts
       │    │    ├─> anthropic.ts
       │    │    └─> gemini.ts
       │    └─> analytics.ts (track metrics)
       └─> github.ts (post review with comments)
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

```bash
# Clone the repo
git clone https://github.com/Anyrouter232/pr-pilot.git
cd pr-pilot

# Install dependencies
npm install

# Run tests
npm test

# Lint
npm run lint

# Bundle for release
npm run bundle
```

## License

MIT
