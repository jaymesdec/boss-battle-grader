// =============================================================================
// Anthropic Client - Claude API Integration
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

let anthropicInstance: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropicInstance = new Anthropic({ apiKey });
  }
  return anthropicInstance;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return getAnthropicClient()[prop as keyof Anthropic];
  },
});

export const MODEL = 'claude-sonnet-4-5-20250929';
export const MAX_TOKENS = 4096;
