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
- Optional PostgreSQL workspace persistence through Prisma
- Workspace import/export as JSON
- API routes for upload, search, chat, graph, stream, export and workspace storage
- Prisma schema and migration for PostgreSQL + pgvector
- Docker Compose for PostgreSQL, Redis and MinIO

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional PostgreSQL Persistence

The app works without a database and falls back to browser-local autosave. To enable server-side persistence:

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev
```

The UI status panel shows `DB Autosave` when `/api/workspace` can read and write through Prisma. If the database is unavailable, the app automatically falls back to `Browser Autosave`.

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

1. Move ingestion from API request handling to worker jobs.
2. Add OpenAI embeddings using `text-embedding-3-small`.
3. Add pgvector retrieval queries over persisted chunks.
4. Wire `/api/chat/stream` into the chat UI.
5. Add Auth.js or OIDC.
6. Add role-based access checks for organization and workspace scope.
7. Add source-span highlighting in document preview.
