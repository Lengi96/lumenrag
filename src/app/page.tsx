"use client";

import {
  Brain,
  Database,
  Download,
  FileText,
  GitBranch,
  HardDrive,
  History,
  KeyRound,
  Layers3,
  Lock,
  Moon,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MindmapCanvas } from "@/components/MindmapCanvas";
import { buildMindmap } from "@/lib/knowledge";
import { sampleDocuments } from "@/lib/sample-data";
import type { KnowledgeDocument, MindmapNode, SearchResult } from "@/lib/types";

const workspaceStorageKey = "lumenrag.workspace.v1";

export default function Home() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(sampleDocuments);
  const [query, setQuery] = useState("Welche Risiken und Anforderungen gibt es?");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "documents" | "mindmap" | "architecture">("chat");
  const [isBusy, setIsBusy] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const graph = useMemo(() => buildMindmap(documents), [documents]);
  const allRequirements = documents.flatMap((document) => document.requirements);
  const allRisks = documents.flatMap((document) => document.risks);

  useEffect(() => {
    const saved = window.localStorage.getItem(workspaceStorageKey);
    if (saved) {
      try {
        const payload = JSON.parse(saved) as { documents?: KnowledgeDocument[] };
        if (Array.isArray(payload.documents)) {
          queueMicrotask(() => setDocuments(payload.documents ?? sampleDocuments));
        }
      } catch {
        window.localStorage.removeItem(workspaceStorageKey);
      }
    }
    queueMicrotask(() => setWorkspaceLoaded(true));
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;
    window.localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        documents,
      }),
    );
  }, [documents, workspaceLoaded]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setIsBusy(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload analysis failed");
      const payload = (await response.json()) as { documents: KnowledgeDocument[] };
      setDocuments((current) => [...payload.documents, ...current]);
      setActiveTab("mindmap");
    } finally {
      setIsBusy(false);
    }
  }

  async function runSearch() {
    setIsBusy(true);
    try {
      const [searchResponse, chatResponse] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, documents, limit: 8 }),
        }),
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, documents }),
        }),
      ]);
      if (!searchResponse.ok || !chatResponse.ok) throw new Error("Search failed");
      const searchPayload = (await searchResponse.json()) as { results: SearchResult[] };
      const chatPayload = (await chatResponse.json()) as { answer: string };
      setResults(searchPayload.results);
      setAnswer(chatPayload.answer);
    } finally {
      setIsBusy(false);
    }
  }

  async function exportWorkspace() {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    });
    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lumenrag-workspace-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(file: File | undefined) {
    if (!file) return;
    const payload = JSON.parse(await file.text()) as { documents?: KnowledgeDocument[] };
    if (Array.isArray(payload.documents)) {
      setDocuments(payload.documents);
      setActiveTab("documents");
    }
  }

  function resetWorkspace() {
    setDocuments(sampleDocuments);
    setResults([]);
    setAnswer("");
    window.localStorage.removeItem(workspaceStorageKey);
  }

  return (
    <main className="min-h-screen bg-[#08100f] text-slate-100">
      <div className="grid min-h-screen grid-cols-[280px_1fr] max-lg:grid-cols-1">
        <aside className="border-r border-white/10 bg-[#0b1514] px-5 py-5 max-lg:border-b max-lg:border-r-0">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-300 text-slate-950">
              <Brain size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal">LumenRAG</h1>
              <p className="text-xs text-slate-400">AI Knowledge Workspace</p>
            </div>
          </div>

          <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-cyan-300/35 bg-cyan-300/8 px-4 py-4 text-sm text-cyan-100 transition hover:bg-cyan-300/12">
            <Upload size={18} />
            <span>Dokumente hochladen</span>
            {isBusy && <span className="ml-auto text-xs text-cyan-200">läuft...</span>}
            <input
              className="hidden"
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.log,.xml,.yaml,.yml,.ts,.tsx,.js,.py,.java,.cs,.pdf,.docx"
              onChange={(event) => void onUpload(event.target.files)}
            />
          </label>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/8"
            >
              <HardDrive size={14} />
              Import
            </button>
            <button
              onClick={resetWorkspace}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/8"
            >
              <History size={14} />
              Reset
            </button>
            <input
              ref={importInputRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importWorkspace(event.target.files?.[0])}
            />
          </div>

          <nav className="space-y-2">
            {[
              ["chat", Search, "RAG Chat"],
              ["documents", FileText, "Dokumente"],
              ["mindmap", Network, "Mindmap"],
              ["architecture", Layers3, "Architektur"],
            ].map(([id, Icon, label]) => (
              <button
                key={id as string}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                  activeTab === id ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/8"
                }`}
              >
                <Icon size={17} />
                {label as string}
              </button>
            ))}
          </nav>

          <div className="mt-8 space-y-3 text-xs text-slate-400">
            <StatusRow icon={<Database size={14} />} label="Storage" value="Postgres + pgvector ready" />
            <StatusRow icon={<HardDrive size={14} />} label="Lokal" value="Workspace Autosave aktiv" />
            <StatusRow icon={<Lock size={14} />} label="RBAC" value="Owner/Admin/Editor/Viewer" />
            <StatusRow icon={<Moon size={14} />} label="Theme" value="Dark Mode native" />
            <StatusRow icon={<KeyRound size={14} />} label="API" value="REST/tRPC planned" />
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex items-center justify-between border-b border-white/10 px-7 py-5 max-md:flex-col max-md:items-start max-md:gap-4">
            <div>
              <p className="text-sm text-cyan-200">Workspace: Technical Knowledge Base</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                Dokumente analysieren, durchsuchen und als Wissensnetz verstehen
              </h2>
            </div>
            <button
              onClick={exportWorkspace}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Download size={16} />
              Export
            </button>
          </header>

          <div className="grid grid-cols-4 gap-4 px-7 py-5 max-xl:grid-cols-2 max-sm:grid-cols-1">
            <Metric label="Dokumente" value={documents.length.toString()} icon={<FileText size={18} />} />
            <Metric label="Chunks" value={documents.reduce((sum, doc) => sum + doc.chunks.length, 0).toString()} icon={<GitBranch size={18} />} />
            <Metric label="Anforderungen" value={allRequirements.length.toString()} icon={<Sparkles size={18} />} />
            <Metric label="Risiken" value={allRisks.length.toString()} icon={<ShieldCheck size={18} />} />
          </div>

          {activeTab === "chat" && (
            <div className="grid grid-cols-[1fr_360px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex gap-3 max-md:flex-col">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-h-11 flex-1 rounded-md border border-white/10 bg-black/25 px-4 text-sm outline-none ring-cyan-300/30 transition focus:ring-4"
                    placeholder="Frage an alle Dokumente stellen..."
                  />
                  <button
                    onClick={runSearch}
                    disabled={isBusy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                  >
                    <Search size={16} />
                    Suchen
                  </button>
                </div>

                <div className="mt-5 rounded-lg border border-white/10 bg-[#0b1514] p-5">
                  {answer ? (
                    <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-a:text-cyan-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center text-center text-slate-400">
                      <Brain className="mb-4 text-cyan-200" size={34} />
                      <p className="max-w-md text-sm">
                        Starte eine Suche. Der MVP erzeugt eine quellenbasierte Antwort aus lokalen Chunks und ist für OpenAI Streaming vorbereitet.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-200">Quellen & Highlights</h3>
                <div className="space-y-3">
                  {results.length === 0 ? (
                    <p className="text-sm text-slate-400">Noch keine Suchergebnisse.</p>
                  ) : (
                    results.map((result) => (
                      <article key={result.chunk.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-100">{result.chunk.documentTitle}</p>
                          <span className="text-xs text-cyan-200">{result.score.toFixed(2)}</span>
                        </div>
                        <p className="line-clamp-4 text-xs leading-5 text-slate-400">{result.chunk.content}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {result.highlights.map((highlight) => (
                            <span key={highlight} className="rounded bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </aside>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="grid grid-cols-[1fr_390px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <div className="grid grid-cols-[1.4fr_.8fr_.8fr_.5fr] border-b border-white/10 px-4 py-3 text-xs uppercase text-slate-500 max-md:hidden">
                  <span>Name</span>
                  <span>Klasse</span>
                  <span>Tags</span>
                  <span>Chunks</span>
                </div>
                {documents.map((doc) => (
                  <article key={doc.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_.5fr] gap-4 border-b border-white/10 px-4 py-4 last:border-b-0 max-md:block">
                    <div>
                      <h3 className="text-sm font-semibold">{doc.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{doc.summary}</p>
                    </div>
                    <p className="text-sm text-slate-300 max-md:mt-3">{doc.classification}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded bg-white/8 px-2 py-1 text-xs text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-300">{doc.chunks.length}</p>
                  </article>
                ))}
              </section>

              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Automatische Extraktion</h3>
                <div className="mt-4 space-y-5">
                  <ExtractionList title="Anforderungen" items={allRequirements.map((item) => item.title)} color="bg-amber-300/15 text-amber-100" />
                  <ExtractionList title="Risiken" items={allRisks.map((item) => item.title)} color="bg-red-300/15 text-red-100" />
                </div>
              </aside>
            </div>
          )}

          {activeTab === "mindmap" && (
            <div className="grid grid-cols-[1fr_340px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <MindmapCanvas graph={graph} selectedNodeId={selectedNode?.id} onSelectNode={setSelectedNode} />
              </section>
              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Mindmap Inspector</h3>
                {selectedNode ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xl font-semibold">{selectedNode.label}</p>
                    <p className="text-sm text-slate-400">Typ: {selectedNode.kind}</p>
                    <p className="text-sm leading-6 text-slate-300">
                      Die Mindmap verbindet Dokumente mit Themen, Anforderungen und Risiken. Gemeinsame Tags erzeugen geteilte Topic-Knoten.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    Klicke einen Knoten an, um Details zu sehen. Nach jedem Upload wird der Graph automatisch neu aufgebaut.
                  </p>
                )}
              </aside>
            </div>
          )}

          {activeTab === "architecture" && (
            <div className="px-7 pb-7">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="mb-5 text-lg font-semibold">Zielarchitektur für Produktionsbetrieb</h3>
                <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
                  <ArchitectureCard title="Ingestion Worker" items={["Parser für PDF/DOCX/MD/Code", "Semantisches Chunking", "Idempotente Jobs mit Retry"]} />
                  <ArchitectureCard title="Retrieval Engine" items={["pgvector + Full Text", "Graph Expansion", "Reranking und Context Packing"]} />
                  <ArchitectureCard title="AI Services" items={["OpenAI Streaming", "Schema-basierte Extraktion", "Requirements, Risiken, Testfälle"]} />
                  <ArchitectureCard title="Security" items={["Organisationen und Workspaces", "RBAC + API Keys", "Audit Logs und Rate Limits"]} />
                  <ArchitectureCard title="Visualization" items={["Mindmaps", "Knowledge Graphs", "Requirement Maps"]} />
                  <ArchitectureCard title="Deployment" items={["Docker Compose", "PostgreSQL + pgvector", "Redis/Queue + S3 Storage"]} />
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between text-cyan-200">
        {icon}
        <span className="text-xs text-slate-500">Live</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function StatusRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-cyan-200">{icon}</span>
      <span>
        <span className="block text-slate-300">{label}</span>
        <span>{value}</span>
      </span>
    </div>
  );
}

function ExtractionList({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase text-slate-500">{title}</p>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <p key={item} className={`rounded-md px-3 py-2 text-xs leading-5 ${color}`}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ArchitectureCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h4 className="mb-3 text-sm font-semibold text-cyan-100">{title}</h4>
      <ul className="space-y-2 text-sm text-slate-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
