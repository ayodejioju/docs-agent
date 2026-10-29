import type { Index } from "./retrieve.js";

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_docs",
      description:
        "Search the internal documentation. Returns the most relevant passages with their source file and heading. Use short keyword queries. Call again with different keywords if the first results do not answer the question.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Keywords to search for" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_docs",
      description: "List the names of all available documentation files.",
      parameters: { type: "object", properties: {} },
    },
  },
];

/**
 * Passages are wrapped in <document> tags and labelled as untrusted data. The model
 * is told in the system prompt to never follow instructions found inside them.
 */
export function runTool(name: string, input: unknown, index: Index): string {
  switch (name) {
    case "search_docs": {
      const query = typeof (input as { query?: unknown })?.query === "string" ? (input as { query: string }).query : "";
      if (!query.trim()) return "Error: query must be a non-empty string.";
      const hits = index.search(query, 3);
      if (hits.length === 0) return "No matching passages found.";
      return hits
        .map(
          (h) =>
            `<document source="${h.chunk.source}" section="${h.chunk.heading}">\n${h.chunk.text}\n</document>`,
        )
        .join("\n\n");
    }
    case "list_docs":
      return index.sources().join("\n");
    default:
      return `Error: unknown tool "${name}".`;
  }
}
