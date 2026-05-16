# Contributing to LumenRAG

Thanks for taking the time to improve LumenRAG. This project is an early-stage RAG knowledge workspace, so the best contributions are small, well-scoped changes that keep the local-first development path reliable.

## Ways to contribute

- Pick an open item from `ROADMAP.md`.
- Improve setup, documentation, or examples for fresh clones.
- Fix parser, chunking, extraction, search, or persistence bugs.
- Add tests or CI coverage for existing behavior before broadening the product surface.

## Local development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app works without OpenAI. Without `OPENAI_API_KEY`, chat answers use the local deterministic answer generator and no prompts are sent to OpenAI.

## Docker development

Start the full local stack:

```bash
docker compose up --build
```

This starts the Next.js app, PostgreSQL with `pgvector`, Redis, and MinIO. The stack runs `prisma migrate deploy` before the app starts.

To seed the demo workspace into the Docker database:

```bash
docker compose run --rm migrate npm run seed:demo
```

## Database workflow

For local PostgreSQL persistence:

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev
```

To seed the local database:

```bash
npm run seed:demo
```

## Required checks

Run these before opening a pull request:

```bash
npm run lint
npm run build
```

For Prisma schema validation, set `DATABASE_URL` and run:

```bash
npx prisma validate
```

GitHub Actions runs install, Prisma generation, Prisma validation, lint, and build on pushes to `main` and on pull requests.

## Pull request expectations

- Keep changes focused on one roadmap item or one bug.
- Update `ROADMAP.md` when completing a roadmap item.
- Update `README.md` or docs when setup, behavior, or data-flow expectations change.
- Include screenshots for visible UI changes.
- Avoid committing secrets, real customer documents, or private source material.

## Data and AI provider notes

LumenRAG is intended to be usable locally. Be explicit in documentation and UI changes about when data leaves the machine. OpenAI-backed behavior must remain optional unless the roadmap explicitly changes that boundary.
