# LumenRAG

LumenRAG is a modern open-source RAG knowledge workspace for technical documents, requirements, architecture knowledge and source-grounded AI search.

It is inspired by graph-based RAG architectures, but implemented as a TypeScript-first product with a clean path to PostgreSQL, pgvector, workers and OpenAI streaming.

## Current MVP

- Next.js + TypeScript + Tailwind
- Local document upload for text-like files
- Chunking
- Keyword/semantic-style search
- Source-grounded answer generation
- Document classification
- Requirement extraction
- Risk extraction
- Automatic tags
- Interactive mindmap from uploaded documents
- Workspace export as JSON
- Prisma schema for production persistence
- Docker Compose for PostgreSQL, Redis and MinIO

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
