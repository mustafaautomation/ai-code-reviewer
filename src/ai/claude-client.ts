export interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export class ClaudeClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(prompt: string): Promise<{ text: string; tokensUsed: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Claude API error: ${res.status} ${errorBody}`);
    }

    const data = (await res.json()) as ClaudeResponse;
    const text = data.content.find((c) => c.type === 'text')?.text || '';
    const tokensUsed = data.usage.input_tokens + data.usage.output_tokens;

    return { text, tokensUsed };
  }

  getModel(): string {
    return this.model;
  }
}
