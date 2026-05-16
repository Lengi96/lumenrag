import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { structuredExtractionSchema, type StructuredExtraction } from "./extraction-schemas";

export type StructuredExtractionInput = {
  documentTitle: string;
  content: string;
};

const emptyExtraction: StructuredExtraction = {
  requirements: [],
  risks: [],
  entities: [],
  relations: [],
  testCases: [],
  userStories: [],
  knowledgeGaps: [],
};

export async function extractStructuredKnowledge(input: StructuredExtractionInput): Promise<StructuredExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    return emptyExtraction;
  }

  const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(structuredExtractionSchema, {
    name: "structured_knowledge_extraction",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "You extract structured knowledge from technical documents.",
        "Use only evidence from the supplied document.",
        "Return concise items with confidence and source evidence.",
        "If something is not supported by the document, omit it.",
      ].join("\n"),
    ],
    [
      "human",
      "Document title: {documentTitle}\n\nDocument content:\n{content}",
    ],
  ]);

  const chain = prompt.pipe(structuredModel);
  const result = await chain.invoke({
    documentTitle: input.documentTitle,
    content: input.content.slice(0, 18000),
  });

  return structuredExtractionSchema.parse(result);
}
