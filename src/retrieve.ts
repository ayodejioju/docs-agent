import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Chunk {
  id: string;
  source: string; // file name
  heading: string; // nearest markdown heading
  text: string;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

/** Split every .md file in `dir` into chunks, one per heading section. */
export function loadChunks(dir: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n");
    let heading = file;
    let buf: string[] = [];
    const flush = () => {
      const text = buf.join("\n").trim();
      if (text) chunks.push({ id: `${file}#${chunks.length}`, source: file, heading, text });
      buf = [];
    };
    for (const line of lines) {
      const m = /^#{1,6}\s+(.*)$/.exec(line);
      if (m) {
        flush();
        heading = m[1].trim();
      } else {
        buf.push(line);
      }
    }
    flush();
  }
  return chunks;
}

const STOPWORDS = new Set(
  "a an and are as at be by do does for from how i in is it of on or our that the to we what when where which who why with you your".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

/** Tiny BM25 index. No external service, so it is fast, free and easy to test. */
export class Index {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number }[];
  private df = new Map<string, number>();
  private avgLen: number;

  constructor(chunks: Chunk[], private k1 = 1.5, private b = 0.75) {
    this.docs = chunks.map((chunk) => {
      const tokens = tokenize(`${chunk.heading} ${chunk.heading} ${chunk.text}`); // weight headings x2
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return { chunk, tf, len: tokens.length };
    });
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(this.docs.length, 1);
  }

  get size(): number {
    return this.docs.length;
  }

  search(query: string, k = 3): Hit[] {
    const terms = tokenize(query);
    const n = this.docs.length;
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen));
      }
      if (score > 0) hits.push({ chunk: d.chunk, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** Full list of document names, used by the list_docs tool. */
  sources(): string[] {
    return [...new Set(this.docs.map((d) => d.chunk.source))];
  }
}
