export type EmbeddingProvider = {
  embed(texts: string[]): Promise<number[][]>;
};

export type ChatProvider = {
  answer(input: {
    system: string;
    query: string;
    context: string;
  }): Promise<string>;
};

export class MissingProviderError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured. Set the required environment variables first.`);
  }
}
