// =============================================================================
// Agent Loop - Core agent execution logic
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODEL, MAX_TOKENS } from '@/lib/anthropic';
import { allToolDefinitions, executeTool } from '@/lib/tools/registry';
import { getSystemPromptForTask } from './context';
import { AGENT_SYSTEM_PROMPT } from './prompts';
import type { SessionState, AgentTaskType } from '@/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// PDF image formatted for Claude's vision API
interface PDFImageForAI {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg';
    data: string;
  };
}

interface AgentLoopConfig {
  task: AgentTaskType;
  userMessage: string;
  context: Partial<SessionState>;
  maxIterations?: number;
  pdfImages?: PDFImageForAI[];
  onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string) => void;
}

interface AgentLoopResult {
  success: boolean;
  result: string;
  toolsUsed: string[];
  iterations: number;
  error?: string;
}

// -----------------------------------------------------------------------------
// Agent Loop Execution
// -----------------------------------------------------------------------------

export async function runAgentLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const {
    task,
    userMessage,
    context,
    maxIterations = 10,
    pdfImages,
    onToolCall,
    onToolResult,
  } = config;

  const toolsUsed: string[] = [];
  let iterations = 0;

  // Build system prompt
  const systemPrompt = AGENT_SYSTEM_PROMPT + '\n\n' + getSystemPromptForTask(task, context);

  // Convert tool definitions to Anthropic format
  const tools: Anthropic.Tool[] = allToolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
  }));

  // Build user message content - include images if provided for vision analysis
  const userContent: Anthropic.ContentBlockParam[] = [];

  // Add PDF images first so Claude sees the visual content
  if (pdfImages && pdfImages.length > 0) {
    userContent.push({
      type: 'text',
      text: `I'm providing ${pdfImages.length} slide images from the student's PDF submission for your visual analysis:\n`,
    });

    for (let i = 0; i < pdfImages.length; i++) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: pdfImages[i].source.data,
        },
      });
      userContent.push({
        type: 'text',
        text: `[Slide ${i + 1}]`,
      });
    }

    userContent.push({
      type: 'text',
      text: '\n\n' + userMessage,
    });
  } else {
    userContent.push({
      type: 'text',
      text: userMessage,
    });
  }

  // Initialize message history
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userContent },
  ];

  // Context provider for read_context tool
  const contextProvider = () => JSON.stringify({
    task,
    context,
    systemPrompt: 'Available in system message',
  });

  try {
    while (iterations < maxIterations) {
      iterations++;

      // Call Claude
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      });

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // If no tool use, extract final text and return
      if (toolUseBlocks.length === 0) {
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const finalText = textBlocks.map((b) => b.text).join('\n');

        return {
          success: true,
          result: finalText,
          toolsUsed,
          iterations,
        };
      }

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);

        if (onToolCall) {
          onToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
        }

        const { output, isCompletion } = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          contextProvider
        );

        if (onToolResult) {
          onToolResult(toolUse.name, output);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: output,
        });

        // If this was a completion signal, we're done
        if (isCompletion) {
          const parsed = JSON.parse(output);
          return {
            success: parsed.success,
            result: parsed.notes || 'Task completed',
            toolsUsed,
            iterations,
          };
        }
      }

      // Add assistant message and tool results to history
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    // Max iterations reached
    return {
      success: false,
      result: 'Agent reached maximum iterations without completing',
      toolsUsed,
      iterations,
      error: 'Max iterations exceeded',
    };
  } catch (error) {
    return {
      success: false,
      result: '',
      toolsUsed,
      iterations,
      error: error instanceof Error ? error.message : 'Unknown error in agent loop',
    };
  }
}

// -----------------------------------------------------------------------------
// Streaming Agent Loop (for UI feedback)
// -----------------------------------------------------------------------------

export async function* streamAgentLoop(
  config: AgentLoopConfig
): AsyncGenerator<{
  type: 'tool_call' | 'tool_result' | 'text' | 'done' | 'error';
  data: unknown;
}> {
  const { task, userMessage, context, maxIterations = 10 } = config;

  const toolsUsed: string[] = [];
  let iterations = 0;

  const systemPrompt = AGENT_SYSTEM_PROMPT + '\n\n' + getSystemPromptForTask(task, context);

  const tools: Anthropic.Tool[] = allToolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  const contextProvider = () => JSON.stringify({ task, context });

  try {
    while (iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );

        for (const block of textBlocks) {
          yield { type: 'text', data: block.text };
        }

        yield {
          type: 'done',
          data: { success: true, toolsUsed, iterations },
        };
        return;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);

        yield {
          type: 'tool_call',
          data: { name: toolUse.name, input: toolUse.input },
        };

        const { output, isCompletion } = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          contextProvider
        );

        yield {
          type: 'tool_result',
          data: { name: toolUse.name, output },
        };

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: output,
        });

        if (isCompletion) {
          const parsed = JSON.parse(output);
          yield {
            type: 'done',
            data: { success: parsed.success, toolsUsed, iterations },
          };
          return;
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    yield {
      type: 'error',
      data: { error: 'Max iterations exceeded', toolsUsed, iterations },
    };
  } catch (error) {
    yield {
      type: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        toolsUsed,
        iterations,
      },
    };
  }
}
