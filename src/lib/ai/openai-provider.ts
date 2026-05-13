import { MissingProviderError, type ChatProvider, type EmbeddingProvider } from "./provider";

type OpenAIEmbeddingResponse = {
  data: { embedding: number[] }[];
};

type OpenAIChatResponse = {
  choices: { message: { content: string | null } }[];
};

export class OpenAIProvider implements EmbeddingProvider, ChatProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) throw new MissingProviderError("OpenAI");

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding request failed: ${response.status}`);
    }

    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    return payload.data.map((item) => item.embedding);
  }

  async answer(input: { system: string; query: string; context: string }): Promise<string> {
    if (!this.apiKey) throw new MissingProviderError("OpenAI");

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: `Frage:\n${input.query}\n\nKontext:\n${input.context}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI chat request failed: ${response.status}`);
    }

    const payload = (await response.json()) as OpenAIChatResponse;
    return payload.choices[0]?.message.content ?? "";
  }
}
