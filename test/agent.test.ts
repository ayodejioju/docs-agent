import { test } from "node:test";
import assert from "node:assert/strict";
import { ask, type LLM } from "../src/agent.js";
import { Index, loadChunks } from "../src/retrieve.js";
import { runTool } from "../src/tools.js";

const index = new Index(loadChunks("docs"));

const msg = (content: any, role: "user" | "assistant" | "tool" = "user"): any => {
  const base: any = {
    role,
    content: content ?? null,
    ...(role === "assistant" && {
      tool_calls: [],
      function_call: null,
    }),
  };
  return base;
};

function fakeLLM(script: any[]) {
  const calls: any[] = [];
  const llm: LLM = {
    chat: {
      completions: {
        async create(params: any) {
          calls.push(structuredClone(params));
          const next = script.shift();
          if (!next) throw new Error("script exhausted");
          const finishReason = next.tool_calls && next.tool_calls.length > 0 ? "tool_calls" : "stop";
          const result: any = {
            choices: [
              {
                index: 0,
                finish_reason: finishReason,
                message: {
                  role: next.role,
                  content: next.content,
                  tool_calls: next.tool_calls,
                  function_call: next.function_call,
                },
              },
            ],
            usage: { input_tokens: 0, output_tokens: 0 },
          };
          calls.push(structuredClone(params));
          return result;
        },
      } as any,
    } as any,
  };
  return { llm, calls };
}

test("agent loop: model calls a tool, gets results, then answers", async () => {
  const { llm, calls } = fakeLLM([
    {
      role: "assistant" as const,
      content: null,
      tool_calls: [
        {
          id: "t1",
          type: "function" as const,
          function: {
            name: "search_docs",
            arguments: JSON.stringify({ query: "rollback" }),
          },
        },
      ],
    } as any,
    {
      role: "assistant" as const,
      content: "Re-run the previous pipeline run (deployments.md).",
      tool_calls: [],
    } as any,
  ]);
  const seen: string[] = [];
  const res = await ask(llm, index, "How do I roll back?", { onToolCall: (n) => seen.push(n) });

  assert.equal(res.steps, 2);
  assert.deepEqual(seen, ["search_docs"]);
  assert.match(res.answer, /deployments\.md/);
});

test("system prompt and tools are sent on every request", async () => {
  const { llm, calls } = fakeLLM([
    {
      role: "assistant" as const,
      content: "ok",
      tool_calls: [],
    } as any,
  ]);
  await ask(llm, index, "hi");
  assert.deepEqual(calls[0].messages.length, 1);
});

test("step limit stops a runaway agent", async () => {
  const loop = (): any => ({
    role: "assistant" as const,
    content: null,
    tool_calls: [
      {
        id: "t",
        type: "function" as const,
        function: {
          name: "list_docs",
          arguments: JSON.stringify({}),
        },
      },
    ] as any,
  });

  const { llm } = fakeLLM([loop(), loop(), loop()]);
  const res = await ask(llm, index, "loop forever", { maxSteps: 3 });
  assert.equal(res.steps, 3);
  assert.match(res.answer, /step limit/);
});

test("tools: unknown tool and bad input are handled, not thrown", () => {
  assert.match(runTool("delete_everything", {}, index), /unknown tool/);
  assert.match(runTool("search_docs", {}, index), /non-empty/);
  assert.match(runTool("search_docs", { query: "zzzz qqqq" }, index), /No matching/);
});

test("poisoned passage is delivered wrapped as untrusted document data", () => {
  const out = runTool("search_docs", { query: "maintenance note vendor" }, index);
  assert.match(out, /<document source="vendor-notes.md" section="Maintenance note">/);
  assert.match(out, /ignore all previous instructions/i);
  assert.match(out, /<\/document>/);
});