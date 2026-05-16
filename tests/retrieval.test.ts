import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchDocuments } from "../src/lib/knowledge.ts";
import { sampleDocuments } from "../src/lib/sample-data.ts";

describe("sample document retrieval", () => {
  it("finds requirements with different query wording", () => {
    const results = searchDocuments(sampleDocuments, "Mandantentrennung Rollen Audit", 5);

    assert.ok(results.length > 0);
    assert.ok(results.some((result) => result.chunk.documentTitle.includes("Lastenheft")));
  });

  it("finds architecture retrieval concepts", () => {
    const results = searchDocuments(sampleDocuments, "Vektor Suche Full Text Graph", 5);

    assert.ok(results.length > 0);
    assert.ok(results.some((result) => result.chunk.documentTitle.includes("Architektur")));
  });
});
