import type OpenAI from "openai";
import type { Index } from "./retrieve.js";
import { runTool, tools } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";

/** The only thing the agent needs from the SDK. Makes it trivial to fake in tests. */
export interface LLM {
  chat: {
    completions: {
      create(params: {
        model?: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
        max_tokens?: number;
        tools?: any;
        tool_choice?:
          | "none"
          | "auto"
          | { type: "function" };
        parallel_tool_use?: boolean;
      }): Promise<OpenAI.ChatCompletion>;
    };
  };
}

export interface AgentResult {
  answer: string;
  toolCalls: { name: string; input: unknown }[];
  steps: number;
}

export interface AgentOptions {
  model?: string;
  maxSteps?: number;
  onToolCall?: (name: string, input: unknown) => void;
}

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "llama-3.3-70b-versatile";

export async function ask(
  client: LLM,
  index: Index,
  question: string,
  opts: AgentOptions = {}
): Promise<AgentResult> {
  const { model = DEFAULT_MODEL, maxSteps = 6, onToolCall } = opts;

  let messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "user", content: question },
  ];
  const toolCalls: AgentResult["toolCalls"] = [];

  for (let step = 1; step <= maxSteps; step++) {
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature: 0,
      max_tokens: 1024,
      tools,
      tool_choice: "auto",
    });

    // OpenAI returns tool calls in choices[0].message.tool_calls (if any)
    const toolCallsInResponse = res.choices[0].message.tool_calls ?? [];

    if (res.choices[0].finish_reason !== "tool_calls") {
      const answer = res.choices[0].message.content ?? "";
      return { answer: answer.trim(), toolCalls, steps: step };
    }

    // Record tool calls seen
    for (const tc of toolCallsInResponse) {
      toolCalls.push({ name: tc.function.name, input: JSON.parse(tc.function.arguments) });
      onToolCall?.(tc.function.name, JSON.parse(tc.function.arguments));
    }

    // Build tool result messages
    const results: OpenAI.ChatCompletionMessageParam[] = [];
    for (const tc of toolCallsInResponse) {
      const toolName = tc.function.name;
      const toolInput = JSON.parse(tc.function.arguments);
      const toolOutput = runTool(toolName, toolInput, index);
      results.push({
        role: "tool" as const,
        tool_call_id: tc.id,
        content: toolOutput,
      });
    }

    // Append assistant message with tool calls (OpenAI format) + tool results
    messages = [
      { role: "assistant" as const, content: null, tool_calls: toolCallsInResponse.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })) },
      ...results,
    ];
  }

  return {
    answer: "I could not finish within the step limit. Try a more specific question.",
    toolCalls,
    steps: maxSteps,
  };
}