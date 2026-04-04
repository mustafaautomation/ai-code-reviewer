import { ReviewFinding, ReviewResult, Severity } from '../core/types';

const REVIEW_PROMPT = `You are an expert code reviewer. Analyze the following PR diff and provide a structured review.

## PR Information
- **Title:** {title}
- **Author:** {author}
- **Branch:** {head} → {base}
- **Files Changed:** {files_changed}

## Diff
\`\`\`diff
{diff}
\`\`\`

## Instructions
1. Analyze the diff for bugs, security issues, performance problems, and code quality
2. Return a JSON object with this exact structure:

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Short title",
      "description": "What's wrong and why",
      "suggestion": "How to fix it (with code if possible)",
      "category": "bug|security|performance|quality"
    }
  ],
  "summary": "2-3 sentence overall assessment",
  "verdict": "approve|request_changes|comment"
}
\`\`\`

Rules:
- Only flag real issues — no style nitpicks
- Every finding must include a fix suggestion
- verdict = "approve" if no critical/high findings
- verdict = "request_changes" if any critical findings
- Return ONLY valid JSON, no markdown wrapping`;

export function buildReviewPrompt(
  title: string,
  author: string,
  head: string,
  base: string,
  filesChanged: number,
  diff: string,
  maxDiffSize: number,
): string {
  const truncatedDiff = diff.length > maxDiffSize
    ? diff.substring(0, maxDiffSize) + '\n... (truncated)'
    : diff;

  return REVIEW_PROMPT
    .replace('{title}', title)
    .replace('{author}', author)
    .replace('{head}', head)
    .replace('{base}', base)
    .replace('{files_changed}', String(filesChanged))
    .replace('{diff}', truncatedDiff);
}

export function parseReviewResponse(
  response: string,
  prNumber: number,
  repo: string,
  model: string,
  tokensUsed: number,
): ReviewResult {
  // Extract JSON from response (handle markdown wrapping)
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```')) {
    const lines = jsonStr.split('\n');
    lines.shift();
    if (lines[lines.length - 1]?.trim() === '```') lines.pop();
    jsonStr = lines.join('\n');
  }

  const parsed = JSON.parse(jsonStr);

  const findings: ReviewFinding[] = (parsed.findings || []).map((f: Record<string, unknown>) => ({
    severity: f.severity as Severity,
    file: String(f.file || ''),
    line: Number(f.line || 0),
    title: String(f.title || ''),
    description: String(f.description || ''),
    suggestion: f.suggestion ? String(f.suggestion) : undefined,
    category: f.category as ReviewFinding['category'],
  }));

  return {
    prNumber,
    repo,
    findings,
    summary: String(parsed.summary || 'No summary provided'),
    verdict: parsed.verdict || 'comment',
    timestamp: new Date().toISOString(),
    model,
    tokensUsed,
  };
}

export function formatReviewComment(result: ReviewResult): string {
  const lines: string[] = [];

  const icon = result.verdict === 'approve' ? '✅' : result.verdict === 'request_changes' ? '🔴' : '💬';
  lines.push(`## ${icon} AI Code Review`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  if (result.findings.length > 0) {
    const critical = result.findings.filter((f) => f.severity === 'critical').length;
    const high = result.findings.filter((f) => f.severity === 'high').length;
    const medium = result.findings.filter((f) => f.severity === 'medium').length;
    const low = result.findings.filter((f) => f.severity === 'low').length;

    lines.push(`**Findings:** ${critical} critical, ${high} high, ${medium} medium, ${low} low`);
    lines.push('');

    for (const finding of result.findings) {
      const sevEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[finding.severity];
      lines.push(`### ${sevEmoji} [${finding.severity.toUpperCase()}] ${finding.title}`);
      lines.push(`📍 \`${finding.file}:${finding.line}\``);
      lines.push('');
      lines.push(finding.description);
      if (finding.suggestion) {
        lines.push('');
        lines.push('**Suggestion:**');
        lines.push(finding.suggestion);
      }
      lines.push('');
    }
  } else {
    lines.push('No issues found. Code looks good! 🎉');
  }

  lines.push('---');
  lines.push(`*Reviewed by AI (${result.model}) · ${result.findings.length} findings · [Quvantic](https://quvantic.com)*`);

  return lines.join('\n');
}
