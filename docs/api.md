# API Design

## Documents

```http
POST /api/v1/workspaces/:workspaceId/documents
GET /api/v1/workspaces/:workspaceId/documents
GET /api/v1/documents/:documentId
POST /api/v1/documents/:documentId/reindex
DELETE /api/v1/documents/:documentId
```

## Search

```http
POST /api/v1/workspaces/:workspaceId/search
```

Request:

```json
{
  "query": "Welche Risiken gibt es?",
  "mode": "hybrid",
  "limit": 12
}
```

Response:

```json
{
  "results": [
    {
      "chunkId": "ck...",
      "documentId": "doc...",
      "score": 0.91,
      "content": "...",
      "highlights": ["Risiko", "Datenschutz"]
    }
  ]
}
```

## Chat

```http
POST /api/v1/workspaces/:workspaceId/chat
```

Response shape:

```ts
type RagAnswer = {
  answer: string;
  citations: {
    documentId: string;
    chunkId: string;
    title: string;
    page?: number;
    quote: string;
    startOffset?: number;
    endOffset?: number;
    score: number;
  }[];
};
```

## Graph

```http
GET /api/v1/workspaces/:workspaceId/graph
GET /api/v1/workspaces/:workspaceId/requirements
GET /api/v1/workspaces/:workspaceId/risks
POST /api/v1/workspaces/:workspaceId/exports
```
