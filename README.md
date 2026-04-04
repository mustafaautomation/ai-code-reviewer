# AI Code Reviewer

[![CI](https://github.com/mustafaautomation/ai-code-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafaautomation/ai-code-reviewer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude API](https://img.shields.io/badge/Claude_API-Powered-FF6B35.svg)](https://docs.anthropic.com)

AI-powered code review bot. Receives GitHub PR webhooks, fetches the diff, sends it to Claude for analysis, and posts structured review comments with severity-rated findings and fix suggestions.

---

## How It Works

```
GitHub PR Event → Webhook Server → Fetch Diff → Claude Analysis → Post Review Comment
     (opened)        (Express)       (GitHub API)    (Anthropic API)     (GitHub API)
```

1. **PR opened/updated** → GitHub sends webhook to your server
2. **Fetch diff** → Server pulls the PR diff via GitHub API
3. **AI analysis** → Claude reviews the code for bugs, security, performance, quality
4. **Post review** → Structured comment posted on the PR with findings and suggestions

---

## Quick Start

```bash
git clone https://github.com/mustafaautomation/ai-code-reviewer.git
cd ai-code-reviewer
npm install

# Set environment variables
export GITHUB_TOKEN=ghp_your_token
export ANTHROPIC_API_KEY=sk-ant-your_key

# Start webhook server
npm run dev

# Server runs on http://localhost:3000
# Configure GitHub webhook URL: https://your-domain.com/webhook
```

---

## Review Output Example

```markdown
## 🔴 AI Code Review

Critical security issue found in authentication module.

**Findings:** 1 critical, 0 high, 1 medium, 0 low

### 🔴 [CRITICAL] SQL injection in user lookup
📍 `src/db/users.ts:42`

User input is concatenated directly into the SQL query string.

**Suggestion:**
Use parameterized queries: `db.query('SELECT * FROM users WHERE id = $1', [userId])`

### 🟡 [MEDIUM] Missing input validation
📍 `src/routes/api.ts:15`

Request body is used without validation.

**Suggestion:**
Add Zod schema validation before processing.
```

---

## Architecture

```
┌──────────────────────────────────┐
│       GitHub Webhook (POST)      │
│       /webhook endpoint          │
├──────────────────────────────────┤
│       Express Server             │
│       - Validate event           │
│       - Filter: opened/synchronize│
├──────────────────────────────────┤
│       GitHub Client              │
│       - Fetch PR diff            │
│       - Post review comment      │
├──────────────────────────────────┤
│       Claude Client              │
│       - Build review prompt      │
│       - Parse structured JSON    │
├──────────────────────────────────┤
│       Reviewer Engine            │
│       - Prompt templates         │
│       - Response parsing         │
│       - Comment formatting       │
└──────────────────────────────────┘
```

---

## Docker

```bash
docker build -t ai-reviewer .
docker run --rm -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_xxx \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  ai-reviewer
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo access |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `MODEL` | No | Claude model (default: claude-sonnet-4-20250514) |
| `PORT` | No | Server port (default: 3000) |
| `MAX_DIFF_SIZE` | No | Max diff characters sent to AI (default: 8000) |
| `WEBHOOK_SECRET` | No | GitHub webhook secret for verification |

---

## Project Structure

```
ai-code-reviewer/
├── src/
│   ├── core/types.ts          # ReviewFinding, ReviewResult, AppConfig
│   ├── ai/
│   │   ├── claude-client.ts   # Anthropic API wrapper
│   │   └── reviewer.ts        # Prompt builder, response parser, comment formatter
│   ├── github/
│   │   └── client.ts          # GitHub API (fetch diff, post comments)
│   ├── server/
│   │   └── app.ts             # Express webhook server
│   └── index.ts
├── tests/unit/
│   └── reviewer.test.ts       # 10 tests — prompt, parsing, formatting
├── Dockerfile                  # Multi-stage production build
└── .github/workflows/ci.yml
```

---

## License

MIT

---

Built by [Quvantic](https://quvantic.com)
