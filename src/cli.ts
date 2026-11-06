import OpenAI from "openai";
import { createInterface } from "node:readline/promises";
import { ask, type LLM } from "./agent.js";
import { Index, loadChunks } from "./retrieve.js";

const docsDir = process.argv[2] ?? "docs";

const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Set OPENAI_API_KEY (or OPENAI_API_KEY) first (see README).");
  process.exit(1);
}

const baseUrl = process.env.OPENAI_BASE_URL; // e.g. https://api.groq.com/openai/v1
const client = new OpenAI({ apiKey, baseURL: baseUrl }) as unknown as LLM;

const index = new Index(loadChunks(docsDir));
console.log(`Loaded ${index.size} passages from ./${docsDir}. Ask a question (Ctrl+C to quit).\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout });

for (;;) {
  const q = (await rl.question("you> ")).trim();
  if (!q) continue;
  try {
    const { answer, steps } = await ask(client, index, q, {
      onToolCall: (name, input) => console.log(`  [tool] ${name} ${JSON.stringify(input)}`),
    });
    console.log(`\n${answer}\n  (${steps} step${steps === 1 ? "" : "s"})\n`);
  } catch (err) {
    console.error("Request failed:", err instanceof Error ? err.message : err);
  }
}
