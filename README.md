# docs-agent

A small documentation Q&A agent in Node.js and TypeScript. Ask questions in plain English; it searches a folder of markdown docs and answers with citations.

It is deliberately small, and it demonstrates the core pieces of a modern LLM application:

| Concept | Where |
|---|---|
| LLM (the model) | Anthropic API via `@anthropic-ai/sdk` (`src/agent.ts`) |
| RAG (retrieval) | BM25 search over heading-based chunks (`src/retrieve.ts`) |
| Agent (model + tools in a loop) | `ask()` loop with a step limit (`src/agent.ts`) |
| Tools | `search_docs`, `list_docs`, with input validation (`src/tools.ts`) |
| System prompt (guardrails) | Grounding, citations, no secrets (`src/prompt.ts`) |
| Prompt-injection defence | Retrieved text is fenced as untrusted data, plus a poisoned doc and a live eval (`docs/vendor-notes.md`, `evals/`) |

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=your-key      # PowerShell: $env:ANTHROPIC_API_KEY="your-key"
npm start                              # or: npm start -- path/to/your/docs
```

Try: `Can we deploy on a Friday?`, `How do I roll back?`, `Who do I contact for hosting issues?`

Override the model with `ANTHROPIC_MODEL=<model-id>` if you want a different one.

## Test it

```bash
npm test          # 11 offline tests, no API key: retrieval, agent loop (scripted fake model), tool safety
npm run typecheck
npm run eval      # live behavioural evals against the real model (needs a key, costs a few cents)
```

The agent depends on a tiny `LLM` interface rather than the SDK directly, so the loop is tested with a scripted fake model.

## Design notes and limits

- **BM25 instead of embeddings.** Zero extra services and fully testable offline. Keyword search misses synonyms, so the natural next step is a hybrid or embedding retriever behind the same `Index.search` interface.
- **Prompt injection is mitigated, not solved.** Fencing and instructions reduce the risk, and the eval checks it, but no prompt is a guarantee. Real deployments should also limit what tools can do and never put secrets in the model's context.
- **Chunking is by markdown heading.** Very long sections would need size-based splitting.
- No conversation memory: each question is independent.

## Ideas to extend

1. Add a `get_doc` tool and a re-ranking step.
2. Stream responses and add a Vue front end with a chat view.
3. Add eval cases whenever you find a bad answer.
