# LumenRAG Architecture

LumenRAG is a TypeScript-first RAG knowledge workspace inspired by graph-based RAG systems, but structured as a product-grade multi-tenant application.

## Runtime Topology

```txt
Next.js Web/API
  -> Application Services
  -> PostgreSQL + pgvector
  -> Object Storage
  -> Queue Worker
  -> OpenAI / model providers
```

## Ingestion Pipeline

```txt
Upload
 -> checksum and file metadata
 -> parser
 -> semantic chunker
 -> embedding batch
 -> document classifier
 -> entity extraction
 -> requirement extraction
 -> risk and contradiction detection
 -> graph/materialized views
```

The current MVP implements the pipeline locally in the browser for fast iteration. The Prisma schema and service boundaries are prepared for moving the same operations into workers.

## Retrieval Pipeline

```txt
User query
 -> query rewrite
 -> vector search
 -> keyword search
 -> graph expansion
 -> reranking
 -> context packing
 -> streaming answer
 -> citation validation
```

## Mindmap Generation

Mindmaps are generated from:

- documents
- extracted tags/topics
- requirements
- risks
- entities

Shared topics become shared graph nodes, so uploaded documents are clustered automatically by semantic overlap.

## Production Extensions

- Replace local analysis with worker jobs.
- Store original files in S3 or MinIO.
- Store chunks in PostgreSQL with `pgvector`.
- Add OpenAI embeddings and streaming chat in API routes.
- Enable RBAC with organization and workspace scoping.
- Add OpenTelemetry and Langfuse tracing for prompt/retrieval quality.

## Implemented API Routes

The MVP now exposes backend routes that mirror the planned production services:

- `POST /api/documents` analyzes uploaded files and returns normalized document objects.
- `POST /api/search` searches across provided workspace documents.
- `POST /api/chat` returns a grounded answer and citation payload.
- `POST /api/chat/stream` streams citation and token events via Server-Sent Events.
- `POST /api/graph` generates a mindmap graph.
- `POST /api/export` returns a complete workspace export.

These routes are stateless in the MVP. In production they should write through the Prisma repositories and enqueue ingestion jobs.

`GET /api/workspace`, `PUT /api/workspace` and `DELETE /api/workspace` now provide the first server-side persistence boundary. They use Prisma when `DATABASE_URL` is configured and fall back to browser-local storage semantics when the database is unavailable.

## Parser Support

The upload route now supports text-like files, PDF and DOCX. PDF extraction uses `pdf-parse`; DOCX extraction uses `mammoth`. Parser metadata is attached to returned document objects so the UI and future persistence layer can inspect how a document was ingested.
