# PR Pilot

[![CI](https://github.com/Anyrouter232/pr-pilot/actions/workflows/ci.yml/badge.svg)](https://github.com/Anyrouter232/pr-pilot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered pull request reviewer using OpenAI. Get instant, actionable code review feedback on every PR.

## Features

- **Automatic code review** on every pull request
- **Inline comments** on specific lines with severity levels (critical / warning / suggestion / nitpick)
- **Configurable review depth** - concise, standard, or thorough
- **Smart file filtering** - skip lock files, generated code, and binaries
- **Custom review instructions** via prompts
- **CI gating** - optionally fail the workflow if critical issues are found

## Quick Start

1. Add your OpenAI API key as a repository secret named `OPENAI_API_KEY`
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

## Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for API access | `${{ github.token }}` |
| `openai-api-key` | Your OpenAI API key | **required** |
| `model` | OpenAI model to use | `gpt-4o` |
| `max-files` | Max files to review (0 = unlimited) | `20` |
| `exclude-patterns` | Comma-separated glob patterns to skip | `*.lock,package-lock.json,...` |
| `review-level` | Review depth: `concise`, `standard`, `thorough` | `standard` |
| `custom-prompt` | Additional review instructions | `""` |
| `post-summary` | Post a summary comment | `true` |
| `fail-on-issues` | Fail the action if issues found | `false` |

## Advanced Example

```yaml
- uses: Anyrouter232/pr-pilot@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-4o
    review-level: thorough
    max-files: 30
    exclude-patterns: '*.lock,dist/**,*.generated.ts,docs/**'
    custom-prompt: 'Focus on security vulnerabilities and SQL injection risks.'
    fail-on-issues: true
```

## How It Works

1. Triggered on `pull_request` events (opened or updated)
2. Fetches the list of changed files via the GitHub API
3. Filters out excluded files and builds annotated diffs with line numbers
4. Sends the annotated diffs to OpenAI with a structured review prompt
5. Parses the AI response and validates line numbers against the actual diff
6. Posts a single review with inline comments and a summary

## Review Severity Levels

| Level | Emoji | Meaning |
|-------|-------|---------|
| Critical | Red circle | Bugs, security vulnerabilities, data loss risks |
| Warning | Yellow circle | Performance issues, potential bugs, anti-patterns |
| Suggestion | Blue circle | Improvements, better approaches, readability |
| Nitpick | White circle | Style, naming, minor preferences |

## Setting Up Your OpenAI API Key

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. In your repo, go to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `OPENAI_API_KEY`, Value: your API key

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
