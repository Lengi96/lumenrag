# LumenRAG

LumenRAG is a modern open-source RAG knowledge workspace for technical documents, requirements, architecture knowledge and source-grounded AI search.

It is inspired by graph-based RAG architectures, but implemented as a TypeScript-first product with a clean path to PostgreSQL, pgvector, workers and OpenAI streaming.

## Current MVP

- Next.js + TypeScript + Tailwind
- Document upload for text-like files, PDFs and DOCX files
- Chunking
- Keyword/semantic-style search
- Source-grounded answer generation
- Document classification
- Requirement extraction
- Risk extraction
- Automatic tags
- Interactive mindmap from uploaded documents
- Browser-local workspace autosave
- Workspace import/export as JSON
- Stateless API routes for upload, search, chat, graph, stream and export
- Prisma schema for production persistence
- Docker Compose for PostgreSQL, Redis and MinIO

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional OpenAI Mode

Create `.env` from `.env.example` and set:

```bash
OPENAI_API_KEY="..."
```

When the key is present, `/api/chat` uses OpenAI for grounded answer generation. Without a key, the app falls back to the local deterministic answer generator.

## Supported Uploads

The current parser supports:

- `.txt`, `.md`, `.csv`, `.json`, `.log`, `.xml`, `.yaml`, `.yml`
- source files such as `.ts`, `.tsx`, `.js`, `.py`, `.java`, `.cs`
- `.pdf`
- `.docx`

## Production Architecture

See:

- `docs/architecture.md`
- `docs/api.md`
- `prisma/schema.prisma`

## Next Implementation Steps

1. Add Prisma Client and migrations.
2. Move ingestion from browser to worker jobs.
3. Add OpenAI embeddings using `text-embedding-3-small`.
4. Add pgvector retrieval.
5. Add streaming chat route.
6. Add Auth.js or OIDC.
7. Add role-based access checks for organization and workspace scope.
8. Add source-span highlighting in document preview.
