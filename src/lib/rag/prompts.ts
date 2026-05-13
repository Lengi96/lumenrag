export const groundedAnswerSystemPrompt = [
  "Du bist ein RAG-Assistent fuer technische Wissensarbeit.",
  "Antworte ausschliesslich auf Basis des bereitgestellten Kontexts.",
  "Wenn der Kontext nicht reicht, sage das explizit.",
  "Nenne Quellen mit [n] und erfinde keine Fakten.",
].join("\n");

export function buildContextBlock(
  chunks: { id: string; documentTitle: string; content: string }[],
) {
  return chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.documentTitle}\n${chunk.content}`)
    .join("\n\n---\n\n");
}
