# Glossary

This project uses the following domain terms (DDD-style ubiquitous language). All code should refer to these definitions.

| Term | Definition |
|------|------------|
| **Document** | A `.md` file in the documentation directory. Each file becomes one or more `Chunk`s. |
| **Chunk** | A fragment of text from a `Document`, bounded by top-level headings (`#`–`######`). Every `Chunk` has a `source` (filename), `heading`, and `text`. |
| **Hit** | A search result returned by `Index.search(query, k)`: a `Chunk` paired with a relevance `score`. |
| **Source** | The original filename of a `Chunk` (e.g. `deployments.md`). Used for citation. |
| **Tool** | A callable function the agent may invoke at runtime. Currently: `search_docs` (keyword search), `list_docs` (list file names). |
| **ToolCall** | A single invocation of a `Tool`, consisting of a `name` (`"search_docs"` \| `"list_docs"`) and an `input` object matching that tool's parameter schema. |
| **AgentStep** | One iteration of the agent loop: model decides → tool calls → tool results → append to conversation → repeat. |
| **Retriever** | The `Index` class implementing BM25 search over `Chunk`s. Currently the only retriever; future swap (embedding) must honor the same `Index.search` interface. |
| **LLM** | The minimal typed interface (`src/agent.ts`) that the agent loop uses to chat with a model and request tool calls. Designed for easy faking in tests. |