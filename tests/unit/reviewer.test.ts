import { describe, it, expect } from 'vitest';
import { buildReviewPrompt, parseReviewResponse, formatReviewComment } from '../../src/ai/reviewer';

describe('buildReviewPrompt', () => {
  it('should include PR metadata in prompt', () => {
    const prompt = buildReviewPrompt('Fix login', 'alice', 'feat/login', 'main', 3, '+ new code', 8000);
    expect(prompt).toContain('Fix login');
    expect(prompt).toContain('alice');
    expect(prompt).toContain('feat/login');
    expect(prompt).toContain('main');
  });

  it('should truncate long diffs', () => {
    const longDiff = 'x'.repeat(10000);
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, longDiff, 5000);
    expect(prompt).toContain('truncated');
    expect(prompt.length).toBeLessThan(longDiff.length);
  });

  it('should not truncate short diffs', () => {
    const prompt = buildReviewPrompt('PR', 'user', 'h', 'b', 1, '+ line', 8000);
    expect(prompt).not.toContain('truncated');
  });
});

describe('parseReviewResponse', () => {
  it('should parse valid JSON response', () => {
    const json = JSON.stringify({
      findings: [
        { severity: 'high', file: 'src/app.ts', line: 10, title: 'Missing null check', description: 'Could NPE', suggestion: 'Add check', category: 'bug' },
      ],
      summary: 'One issue found',
      verdict: 'request_changes',
    });

    const result = parseReviewResponse(json, 42, 'owner/repo', 'claude-sonnet-4-20250514', 500);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].file).toBe('src/app.ts');
    expect(result.verdict).toBe('request_changes');
    expect(result.prNumber).toBe(42);
  });

  it('should handle markdown-wrapped JSON', () => {
    const wrapped = '```json\n{"findings":[],"summary":"Clean","verdict":"approve"}\n```';
    const result = parseReviewResponse(wrapped, 1, 'r', 'model', 100);
    expect(result.verdict).toBe('approve');
    expect(result.findings).toHaveLength(0);
  });

  it('should handle empty findings', () => {
    const json = '{"findings":[],"summary":"All good","verdict":"approve"}';
    const result = parseReviewResponse(json, 1, 'r', 'm', 50);
    expect(result.findings).toHaveLength(0);
    expect(result.summary).toBe('All good');
  });
});

describe('formatReviewComment', () => {
  it('should format approve verdict', () => {
    const comment = formatReviewComment({
      prNumber: 1,
      repo: 'o/r',
      findings: [],
      summary: 'Looks great',
      verdict: 'approve',
      timestamp: '2025-01-01',
      model: 'claude-sonnet-4-20250514',
      tokensUsed: 100,
    });
    expect(comment).toContain('✅');
    expect(comment).toContain('No issues found');
  });

  it('should format findings with severity icons', () => {
    const comment = formatReviewComment({
      prNumber: 1,
      repo: 'o/r',
      findings: [
        { severity: 'critical', file: 'a.ts', line: 1, title: 'SQL injection', description: 'Bad', category: 'security' },
      ],
      summary: 'Critical issue',
      verdict: 'request_changes',
      timestamp: '2025-01-01',
      model: 'claude-sonnet-4-20250514',
      tokensUsed: 200,
    });
    expect(comment).toContain('🔴');
    expect(comment).toContain('CRITICAL');
    expect(comment).toContain('SQL injection');
    expect(comment).toContain('a.ts:1');
  });

  it('should include all severity levels', () => {
    const comment = formatReviewComment({
      prNumber: 1,
      repo: 'o/r',
      findings: [
        { severity: 'critical', file: 'a.ts', line: 1, title: 'A', description: 'D', category: 'bug' },
        { severity: 'high', file: 'b.ts', line: 2, title: 'B', description: 'D', category: 'security' },
        { severity: 'medium', file: 'c.ts', line: 3, title: 'C', description: 'D', category: 'quality' },
      ],
      summary: 'Multiple issues',
      verdict: 'request_changes',
      timestamp: '2025-01-01',
      model: 'm',
      tokensUsed: 300,
    });
    expect(comment).toContain('1 critical, 1 high, 1 medium, 0 low');
  });
});
