interface EmbeddingResponse {
  data?: Array<{ index: number; embedding: number[] }>;
}

export async function embedTextsOpenAI(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  inputs: string[];
}): Promise<number[][]> {
  const { apiKey, baseUrl, model, inputs } = params;
  if (inputs.length === 0) {
    return [];
  }

  const base = baseUrl.replace(/\/$/, '');
  const all: number[][] = [];
  const batchSize = 24;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const response = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: batch }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embeddings failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    const rows = data.data ?? [];
    rows.sort((a, b) => a.index - b.index);
    for (const row of rows) {
      if (!Array.isArray(row.embedding)) {
        throw new Error('OpenAI embeddings: missing embedding vector');
      }
      all.push(row.embedding);
    }
  }

  return all;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}
