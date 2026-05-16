# LumenRAG Implementation Roadmap

This roadmap is the working plan for turning LumenRAG from MVP into a useful open-source and company-ready RAG knowledge workspace.

Status legend:

- `[x]` done
- `[~]` in progress / partially implemented
- `[ ]` open

## Current Baseline

- `[x]` Next.js + TypeScript + Tailwind app shell
- `[x]` Local upload flow for text, PDF and DOCX
- `[x]` Local chunking and heuristic document analysis
- `[x]` Requirements, risks, entities and tags extraction baseline
- `[x]` Mindmap view from uploaded documents
- `[x]` Local browser autosave
- `[x]` Optional Prisma/PostgreSQL persistence boundary
- `[x]` Docker Compose for PostgreSQL, Redis and MinIO
- `[x]` OpenAI provider skeleton
- `[x]` Streaming API endpoint skeleton
- `[~]` Advanced tabs for Requirements, QA Matrix, Risks, Agents and Enterprise readiness

## Phase 1: Reliable Local Product

Goal: A developer or company evaluator can clone the repo and run a complete local stack without guessing.

- `[x]` Create production-ready `Dockerfile` for the Next.js app
- `[x]` Extend `docker-compose.yml` to run app + Postgres + Redis + MinIO together
- `[ ]` Add `docker compose up` quickstart path that works from a fresh clone
- `[ ]` Add seed/demo workspace command
- `[ ]` Add screenshots or GIFs to README
- `[ ]` Add GitHub Actions CI for lint, build and Prisma validation
- `[ ]` Add license file
- `[ ]` Add `CONTRIBUTING.md`
- `[ ]` Add issue templates for bug, feature and roadmap task

Acceptance criteria:

- Fresh clone can run with one documented command path.
- CI proves every PR builds.
- README explains what data leaves the machine and how to run without OpenAI.

## Phase 2: Real Semantic Retrieval

Goal: Replace heuristic search with actual RAG-quality retrieval.

- `[ ]` Persist uploaded documents and chunks through Prisma by default
- `[ ]` Generate embeddings for chunks using OpenAI `text-embedding-3-small`
- `[ ]` Store embeddings in PostgreSQL `pgvector`
- `[ ]` Add vector similarity search API
- `[ ]` Add PostgreSQL full-text search
- `[ ]` Implement hybrid retrieval: vector + full-text + document metadata
- `[ ]` Add retrieval score explanation in API response
- `[ ]` Add fallback behavior when no embedding provider is configured
- `[ ]` Add basic retrieval tests with sample documents

Acceptance criteria:

- Queries retrieve semantically relevant chunks even when exact keywords differ.
- Search results include document, chunk, score and why it matched.
- App remains usable without OpenAI.

## Phase 3: Streaming RAG Chat UX

Goal: Make the chat feel like a real AI product with traceable sources.

- `[ ]` Wire `/api/chat/stream` into the UI
- `[ ]` Stream answer tokens live
- `[ ]` Show citations before or during the streamed answer
- `[ ]` Add stop/cancel generation button
- `[ ]` Persist conversations and messages
- `[ ]` Add conversation history sidebar
- `[ ]` Add conversation memory with bounded context
- `[ ]` Add "only answer from sources" grounding mode
- `[ ]` Add no-context and low-confidence response states

Acceptance criteria:

- User sees answer generation live.
- Every answer can show supporting sources.
- Conversations survive refresh when DB is enabled.

## Phase 4: Document Preview And Source Highlighting

Goal: Users can verify every answer against the original document context.

- `[ ]` Add document detail view
- `[ ]` Add chunk list per document
- `[ ]` Highlight search matches in chunks
- `[ ]` Link citations from chat to source chunks
- `[ ]` Preserve PDF page numbers where parser exposes them
- `[ ]` Add source drawer next to chat
- `[ ]` Add Markdown and code rendering in document preview
- `[ ]` Add table rendering for Markdown/CSV-like content

Acceptance criteria:

- Clicking a citation opens the exact source chunk.
- User can inspect where a requirement, risk or answer came from.

## Phase 5: Worker-Based Ingestion

Goal: Large documents are processed reliably without blocking API requests.

- `[ ]` Choose queue implementation: BullMQ + Redis or pg-boss
- `[ ]` Add ingestion job table/status model
- `[ ]` Move parsing into worker job
- `[ ]` Move chunking into worker job
- `[ ]` Move embeddings into worker job
- `[ ]` Move requirement/risk/entity extraction into worker job
- `[ ]` Add retry and failure states
- `[ ]` Add progress UI
- `[ ]` Add cancellation/reprocess actions

Acceptance criteria:

- Upload returns quickly.
- User sees processing progress.
- Failed documents can be retried.

## Phase 6: Structured AI Extraction

Goal: Turn heuristic extraction into reliable, schema-based AI workflows.

- `[ ]` Add Zod schemas for requirements, risks, entities, relations and test cases
- `[ ]` Add OpenAI structured extraction provider
- `[ ]` Add local-model compatible JSON extraction mode
- `[ ]` Generate user stories from requirements
- `[ ]` Generate acceptance criteria
- `[ ]` Generate test cases and Gherkin scenarios
- `[ ]` Detect contradictions between documents
- `[ ]` Detect missing requirements or ambiguous language
- `[ ]` Store extraction confidence and source evidence

Acceptance criteria:

- Extracted items have source evidence and confidence.
- Users can distinguish AI suggestions from verified facts.

## Phase 7: Knowledge Graph And Mindmaps

Goal: Make visual knowledge exploration genuinely useful.

- `[~]` Basic mindmap from documents, tags, requirements and risks
- `[ ]` Add zoom and pan
- `[ ]` Add node filtering by type
- `[ ]` Add document-scoped graph mode
- `[ ]` Add requirement map mode
- `[ ]` Add dependency graph mode
- `[ ]` Add graph node detail drawer
- `[ ]` Add graph clustering by semantic similarity
- `[ ]` Export graph as PNG/SVG/JSON
- `[ ]` Persist graph layout preferences

Acceptance criteria:

- Users can visually understand document relationships.
- Graph remains usable with many documents.

## Phase 8: Enterprise Readiness

Goal: Make the project credible for internal company use.

- `[ ]` Add Auth.js or OIDC login
- `[ ]` Add organizations and workspace switching UI
- `[ ]` Add roles: Owner, Admin, Editor, Viewer
- `[ ]` Add API keys with scopes
- `[ ]` Add audit logs for upload, query, export and delete
- `[ ]` Add data retention and delete flows
- `[ ]` Add provider switch: OpenAI, Azure OpenAI, Ollama, vLLM
- `[ ]` Add "local only" mode documentation
- `[ ]` Add rate limits and upload limits
- `[ ]` Add security review checklist

Acceptance criteria:

- A company can run it internally with controlled access.
- It is clear when data goes to external AI providers.

## Phase 9: Open-Source Positioning

Goal: Make the project understandable and attractive to contributors.

- `[ ]` Define concise project positioning in README
- `[ ]` Add architecture diagram
- `[ ]` Add comparison section: why this differs from generic RAG demos
- `[ ]` Add demo scenario: Lastenheft -> Requirements -> Risks -> Tests -> Mindmap
- `[ ]` Add public roadmap labels/issues
- `[ ]` Add examples folder with sample documents
- `[ ]` Add docs for custom parser/plugin contribution
- `[ ]` Add release notes/changelog

Acceptance criteria:

- A new visitor understands the project in under two minutes.
- A developer knows which issue to pick up first.

## Backlog Ideas

- Jira importer
- Confluence exporter/importer
- GitHub repository/code ingestion
- Mermaid architecture graph generation
- RAG evaluation dashboard
- Prompt/version registry
- Langfuse/OpenTelemetry tracing
- Multi-language UI
- Offline/air-gapped deployment guide

## Working Rule For Future Sessions

Before starting new work, check this file and update statuses. After finishing work, update this file again, commit the change and push it.
