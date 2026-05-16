"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
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
  StopCircle,
  Upload,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MindmapCanvas } from "@/components/MindmapCanvas";
import { buildMindmap } from "@/lib/knowledge";
import {
  buildAgentInsights,
  buildArchitectureSummary,
  buildEnterpriseControls,
  buildTestCases,
  buildUserStories,
  findKnowledgeGaps,
} from "@/lib/insights";
import { sampleDocuments } from "@/lib/sample-data";
import type { KnowledgeDocument, MindmapNode, Requirement, SearchResult, TestCase, UserStory } from "@/lib/types";

const workspaceStorageKey = "lumenrag.workspace.v1";
type PersistenceMode = "loading" | "database" | "local";
type ChatCitation = {
  id: number;
  documentId: string;
  chunkId: string;
  title: string;
  quote?: string;
  score: number;
  matchReason?: string;
  vectorScore?: number;
  textScore?: number;
};
type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};
type RetrievalState = {
  mode?: string;
  resultCount: number;
  confidence: "none" | "low" | "medium" | "high";
};

export default function Home() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(sampleDocuments);
  const [query, setQuery] = useState("Welche Risiken und Anforderungen gibt es?");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [retrievalState, setRetrievalState] = useState<RetrievalState>({ resultCount: 0, confidence: "none" });
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [onlySources, setOnlySources] = useState(true);
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);
  const [activeTab, setActiveTab] = useState<
    "chat" | "documents" | "mindmap" | "requirements" | "qa" | "risks" | "agents" | "enterprise" | "architecture"
  >("chat");
  const [isBusy, setIsBusy] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextDatabaseSaveRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const graph = useMemo(() => buildMindmap(documents), [documents]);
  const allRequirements = documents.flatMap((document) => document.requirements);
  const allRisks = documents.flatMap((document) => document.risks);
  const allEntities = documents.flatMap((document) => document.entities);
  const userStories = useMemo(() => buildUserStories(allRequirements), [allRequirements]);
  const testCases = useMemo(() => buildTestCases(allRequirements, allRisks), [allRequirements, allRisks]);
  const knowledgeGaps = useMemo(() => findKnowledgeGaps(documents), [documents]);
  const agentInsights = useMemo(() => buildAgentInsights(documents), [documents]);
  const enterpriseControls = useMemo(() => buildEnterpriseControls(documents), [documents]);
  const architectureSummary = useMemo(() => buildArchitectureSummary(documents), [documents]);
  const qaCoverage = allRequirements.length
    ? Math.round((testCases.filter((testCase) => testCase.coverage !== "missing").length / allRequirements.length) * 100)
    : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const payload = (await response.json()) as {
          mode?: PersistenceMode;
          documents?: KnowledgeDocument[];
        };

        if (cancelled) return;

        if (payload.mode === "database") {
          setPersistenceMode("database");
          if (Array.isArray(payload.documents) && payload.documents.length > 0) {
            setDocuments(payload.documents);
          }
          setWorkspaceLoaded(true);
          return;
        }
      } catch {
        // Falls DB oder API nicht erreichbar sind, bleibt Browser-Speicher aktiv.
      }

      const saved = window.localStorage.getItem(workspaceStorageKey);
      if (saved) {
        try {
          const payload = JSON.parse(saved) as { documents?: KnowledgeDocument[] };
          if (Array.isArray(payload.documents)) {
            setDocuments(payload.documents);
          }
        } catch {
          window.localStorage.removeItem(workspaceStorageKey);
        }
      }

      if (!cancelled) {
        setPersistenceMode("local");
        setWorkspaceLoaded(true);
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
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

    if (persistenceMode !== "database") return;
    if (skipNextDatabaseSaveRef.current) {
      skipNextDatabaseSaveRef.current = false;
      setLastSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Workspace save failed");
          setLastSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
        })
        .catch(() => setPersistenceMode("local"));
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [documents, persistenceMode, workspaceLoaded]);

  useEffect(() => {
    if (persistenceMode !== "database") return;
    void loadConversations();
  }, [persistenceMode]);

  async function loadConversations() {
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { conversations?: ConversationSummary[] };
      setConversations(payload.conversations ?? []);
    } catch {
      setConversations([]);
    }
  }

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
      const payload = (await response.json()) as {
        documents: KnowledgeDocument[];
        persistence?: { mode?: "database" | "local" };
      };
      if (payload.persistence?.mode === "database" && persistenceMode === "database") {
        skipNextDatabaseSaveRef.current = true;
      }
      setDocuments((current) => [...payload.documents, ...current]);
      setActiveTab("mindmap");
    } finally {
      setIsBusy(false);
    }
  }

  async function runSearch() {
    setIsBusy(true);
    setAnswer("");
    setResults([]);
    setCitations([]);
    setRetrievalState({ resultCount: 0, confidence: "none" });
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, documents, conversationId: activeConversationId, onlySources }),
        signal: abortController.signal,
      });
      if (!response.ok || !response.body) throw new Error("Streaming search failed");

      await readEventStream(response.body);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setAnswer("Die Suche konnte nicht abgeschlossen werden.");
      }
    } finally {
      setIsBusy(false);
      streamAbortRef.current = null;
    }
  }

  function stopGeneration() {
    streamAbortRef.current?.abort();
    setIsBusy(false);
  }

  async function readEventStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        handleStreamEvent(rawEvent);
      }
    }
  }

  function handleStreamEvent(rawEvent: string) {
    const event = rawEvent
      .split("\n")
      .find((line) => line.startsWith("event: "))
      ?.slice(7);
    const data = rawEvent
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);

    if (!event || data === undefined) return;

    const payload = JSON.parse(data) as unknown;
    if (event === "citations") {
      setCitations(Array.isArray(payload) ? (payload as ChatCitation[]) : []);
    }
    if (event === "retrieval") {
      setRetrievalState(payload as RetrievalState);
    }
    if (event === "results") {
      setResults(Array.isArray(payload) ? (payload as SearchResult[]) : []);
    }
    if (event === "token") {
      setAnswer((current) => `${current}${String(payload)}`);
    }
    if (event === "done") {
      const donePayload = payload as { conversation?: { id: string } | null };
      if (donePayload.conversation?.id) {
        setActiveConversationId(donePayload.conversation.id);
        void loadConversations();
      }
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        conversation?: {
          id: string;
          messages: { role: string; content: string; citations?: unknown }[];
        };
      };
      const messages = payload.conversation?.messages ?? [];
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
      setActiveConversationId(conversationId);
      setQuery(lastUserMessage?.content ?? query);
      setAnswer(lastAssistantMessage?.content ?? "");
      setCitations(Array.isArray(lastAssistantMessage?.citations) ? (lastAssistantMessage.citations as ChatCitation[]) : []);
      setResults([]);
      setRetrievalState({ resultCount: Array.isArray(lastAssistantMessage?.citations) ? lastAssistantMessage.citations.length : 0, confidence: "medium" });
    } catch {
      // Keep the active chat unchanged if history loading fails.
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
    setCitations([]);
    setActiveConversationId(null);
    setRetrievalState({ resultCount: 0, confidence: "none" });
    window.localStorage.removeItem(workspaceStorageKey);
    if (persistenceMode === "database") {
      void fetch("/api/workspace", { method: "DELETE" }).catch(() => setPersistenceMode("local"));
    }
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
              ["requirements", Sparkles, "Requirements"],
              ["qa", ClipboardCheck, "QA Matrix"],
              ["risks", AlertTriangle, "Risiken"],
              ["agents", Workflow, "AI Agenten"],
              ["enterprise", ShieldCheck, "Enterprise"],
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
            <StatusRow
              icon={<HardDrive size={14} />}
              label="Persistenz"
              value={persistenceMode === "database" ? `DB Autosave${lastSavedAt ? ` ${lastSavedAt}` : ""}` : "Browser Autosave"}
            />
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
            <Metric label="QA Coverage" value={`${qaCoverage}%`} icon={<CheckCircle2 size={18} />} />
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
                  {isBusy ? (
                    <button
                      onClick={stopGeneration}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300/30 bg-red-300/15 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-300/20"
                    >
                      <StopCircle size={16} />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={runSearch}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                    >
                      <Search size={16} />
                      Suchen
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={onlySources}
                      onChange={(event) => setOnlySources(event.target.checked)}
                      className="size-4 accent-cyan-300"
                    />
                    Nur aus Quellen antworten
                  </label>
                  <span>
                    {retrievalState.mode
                      ? `${retrievalState.mode} · ${retrievalState.resultCount} Treffer · ${retrievalState.confidence} confidence`
                      : "Bereit fuer quellenbasierte Suche"}
                  </span>
                </div>

                <div className="mt-5 rounded-lg border border-white/10 bg-[#0b1514] p-5">
                  {retrievalState.confidence === "none" && answer && (
                    <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                      Keine belastbaren Quellen gefunden.
                    </div>
                  )}
                  {retrievalState.confidence === "low" && (
                    <div className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                      Niedrige Retrieval-Konfidenz. Pruefe die Quellen, bevor du die Antwort uebernimmst.
                    </div>
                  )}
                  {answer ? (
                    <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-a:text-cyan-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                      {isBusy && <span className="inline-block h-4 w-2 animate-pulse bg-cyan-200 align-middle" />}
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center text-center text-slate-400">
                      <Brain className="mb-4 text-cyan-200" size={34} />
                      <p className="max-w-md text-sm">
                        Starte eine Suche. Antworten werden live gestreamt und zeigen Quellen, sobald Retrieval abgeschlossen ist.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-200">Unterhaltungen</h3>
                    <button
                      onClick={() => {
                        setActiveConversationId(null);
                        setAnswer("");
                        setCitations([]);
                        setResults([]);
                        setRetrievalState({ resultCount: 0, confidence: "none" });
                      }}
                      className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/8"
                    >
                      Neu
                    </button>
                  </div>
                  {persistenceMode !== "database" ? (
                    <p className="text-xs leading-5 text-slate-500">Conversation History wird aktiv, wenn DB Autosave verfuegbar ist.</p>
                  ) : conversations.length === 0 ? (
                    <p className="text-xs leading-5 text-slate-500">Noch keine gespeicherten Unterhaltungen.</p>
                  ) : (
                    <div className="space-y-2">
                      {conversations.slice(0, 6).map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => void loadConversation(conversation.id)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                            activeConversationId === conversation.id
                              ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50"
                              : "border-white/10 bg-black/20 text-slate-400 hover:bg-white/8"
                          }`}
                        >
                          <span className="block truncate font-medium">{conversation.title}</span>
                          <span className="mt-1 block text-[11px] text-slate-500">{conversation.messageCount} Nachrichten</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <h3 className="mb-4 text-sm font-semibold text-slate-200">Quellen & Highlights</h3>
                <div className="space-y-3">
                  {results.length === 0 && citations.length === 0 ? (
                    <p className="text-sm text-slate-400">Noch keine Suchergebnisse.</p>
                  ) : results.length > 0 ? (
                    results.map((result) => (
                      <article key={result.chunk.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-100">{result.chunk.documentTitle}</p>
                          <span className="text-xs text-cyan-200">{result.score.toFixed(2)}</span>
                        </div>
                        <p className="line-clamp-4 text-xs leading-5 text-slate-400">{result.chunk.content}</p>
                        {result.matchReason && <p className="mt-2 text-[11px] leading-4 text-slate-500">{result.matchReason}</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {result.highlights.map((highlight) => (
                            <span key={highlight} className="rounded bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    citations.map((citation) => (
                      <article key={citation.chunkId} className="rounded-md border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-100">{citation.title}</p>
                          <span className="text-xs text-cyan-200">{citation.score.toFixed(2)}</span>
                        </div>
                        <p className="line-clamp-4 text-xs leading-5 text-slate-400">{citation.quote}</p>
                        {citation.matchReason && <p className="mt-2 text-[11px] leading-4 text-slate-500">{citation.matchReason}</p>}
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

          {activeTab === "requirements" && (
            <div className="grid grid-cols-[1fr_390px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <SectionHeader title="Requirements Engineering" subtitle="User Stories, Akzeptanzkriterien, Prioritaeten und Quellenbezug." />
                <div className="divide-y divide-white/10">
                  {allRequirements.map((requirement) => {
                    const story = userStories.find((item) => item.requirementId === requirement.id);
                    return <RequirementRow key={requirement.id} requirement={requirement} story={story} />;
                  })}
                  {allRequirements.length === 0 && <EmptyState text="Keine Anforderungen erkannt. Lade ein Lastenheft oder Jira-/Confluence-Export hoch." />}
                </div>
              </section>

              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Gap- & Widerspruchs-Inbox</h3>
                <div className="mt-4 space-y-3">
                  {knowledgeGaps.map((gap) => (
                    <InsightCard
                      key={gap.id}
                      title={gap.title}
                      label={gap.severity}
                      tone={gap.severity === "high" ? "red" : "amber"}
                      body={`${gap.evidence} Empfehlung: ${gap.recommendation}`}
                    />
                  ))}
                </div>
              </aside>
            </div>
          )}

          {activeTab === "qa" && (
            <div className="grid grid-cols-[1fr_360px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <SectionHeader title="QA Traceability Matrix" subtitle="Mapping von Anforderungen zu Testfaellen, Gherkin und Risiko." />
                <div className="grid grid-cols-[1fr_.8fr_.8fr_.8fr] border-b border-white/10 px-4 py-3 text-xs uppercase text-slate-500 max-md:hidden">
                  <span>Anforderung</span>
                  <span>Testfall</span>
                  <span>Coverage</span>
                  <span>Risiko</span>
                </div>
                {testCases.map((testCase) => {
                  const requirement = allRequirements.find((item) => item.id === testCase.requirementId);
                  return <TraceabilityRow key={testCase.id} testCase={testCase} requirement={requirement} />;
                })}
                {testCases.length === 0 && <EmptyState text="Noch keine Testfaelle ableitbar." />}
              </section>

              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Regression Impact</h3>
                <div className="mt-4 space-y-3">
                  <MetricMini label="Anforderungen" value={allRequirements.length.toString()} />
                  <MetricMini label="Testfaelle" value={testCases.length.toString()} />
                  <MetricMini label="Teilweise/fehlend" value={testCases.filter((testCase) => testCase.coverage !== "covered").length.toString()} />
                  <MetricMini label="Hohe Risiken" value={allRisks.filter((risk) => risk.severity === "high").length.toString()} />
                </div>
              </aside>
            </div>
          )}

          {activeTab === "risks" && (
            <div className="grid grid-cols-[1fr_360px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <SectionHeader title="Risk Radar" subtitle="Risiken, offene Wissensluecken und moegliche Release-Blocker." />
                <div className="grid grid-cols-3 gap-4 p-4 max-lg:grid-cols-1">
                  {allRisks.map((risk) => (
                    <InsightCard
                      key={risk.id}
                      title={risk.title}
                      label={risk.severity}
                      tone={risk.severity === "high" ? "red" : risk.severity === "medium" ? "amber" : "green"}
                      body={risk.evidence}
                    />
                  ))}
                </div>
              </section>
              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Scope-Erkennung</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {allEntities.slice(0, 18).map((entity) => (
                    <span key={entity.id} className="rounded-md bg-white/8 px-2.5 py-1.5 text-xs text-slate-300">
                      {entity.name} Â· {entity.type}
                    </span>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {activeTab === "agents" && (
            <div className="px-7 pb-7">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <SectionHeader title="AI Agent Review Board" subtitle="Dokumentation, Architektur, QA, Security, Compliance und Release als spezialisierte Reviews." />
                <div className="grid grid-cols-3 gap-4 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
                  {agentInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      title={insight.title}
                      label={insight.priority}
                      tone={insight.priority === "high" ? "red" : insight.priority === "medium" ? "amber" : "green"}
                      body={insight.finding}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "enterprise" && (
            <div className="grid grid-cols-[1fr_360px] gap-5 px-7 pb-7 max-xl:grid-cols-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.035]">
                <SectionHeader title="Enterprise Readiness" subtitle="Rollen, DSGVO, Audit, Datenklassifikation, lokale LLMs und Mandantentrennung." />
                <div className="grid grid-cols-3 gap-4 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
                  {enterpriseControls.map((control) => (
                    <InsightCard
                      key={control.id}
                      title={control.area}
                      label={control.status}
                      tone={control.status === "ready" ? "green" : control.status === "gap" ? "red" : "amber"}
                      body={control.description}
                    />
                  ))}
                </div>
              </section>
              <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-sm font-semibold">Datenklassifikation</h3>
                <div className="mt-4 space-y-2">
                  {documents.map((document) => (
                    <div key={document.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-medium">{document.title}</p>
                      <p className="mt-1 text-xs text-cyan-100">{document.classification}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {activeTab === "architecture" && (
            <div className="px-7 pb-7">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h3 className="mb-5 text-lg font-semibold">Zielarchitektur fÃ¼r Produktionsbetrieb</h3>
                <div className="mb-5 grid grid-cols-3 gap-3 max-xl:grid-cols-1">
                  {architectureSummary.map((item) => (
                    <div key={item} className="rounded-md border border-cyan-300/20 bg-cyan-300/8 p-3 text-sm text-cyan-50">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
                  <ArchitectureCard title="Ingestion Worker" items={["Parser fÃ¼r PDF/DOCX/MD/Code", "Semantisches Chunking", "Idempotente Jobs mit Retry"]} />
                  <ArchitectureCard title="Retrieval Engine" items={["pgvector + Full Text", "Graph Expansion", "Reranking und Context Packing"]} />
                  <ArchitectureCard title="AI Services" items={["OpenAI Streaming", "Schema-basierte Extraktion", "Requirements, Risiken, TestfÃ¤lle"]} />
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

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-white/10 px-5 py-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function RequirementRow({ requirement, story }: { requirement: Requirement; story?: UserStory }) {
  return (
    <article className="px-5 py-4">
      <div className="flex items-start justify-between gap-4 max-md:block">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{requirement.title}</h4>
            <Badge tone={requirement.priority === "must" ? "red" : requirement.priority === "should" ? "amber" : "green"}>
              {requirement.priority}
            </Badge>
            <Badge tone="cyan">{Math.round(requirement.confidence * 100)}% sicher</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-300">{requirement.statement}</p>
          {story && (
            <div className="mt-4 rounded-md border border-cyan-300/15 bg-cyan-300/8 p-3">
              <p className="text-sm font-medium text-cyan-50">{story.story}</p>
              <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-300">
                {story.acceptanceCriteria.map((criterion) => (
                  <li key={criterion}>- {criterion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function TraceabilityRow({ testCase, requirement }: { testCase: TestCase; requirement?: Requirement }) {
  return (
    <article className="grid grid-cols-[1fr_.8fr_.8fr_.8fr] gap-4 border-b border-white/10 px-4 py-4 last:border-b-0 max-md:block">
      <div>
        <p className="text-sm font-semibold">{requirement?.title ?? "Unbekannte Anforderung"}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{requirement?.statement}</p>
      </div>
      <details className="text-sm text-slate-300 max-md:mt-3">
        <summary className="cursor-pointer font-medium">{testCase.title}</summary>
        <pre className="mt-3 overflow-auto rounded-md bg-black/35 p-3 text-xs leading-5 text-slate-300">{testCase.gherkin}</pre>
      </details>
      <div className="max-md:mt-3">
        <Badge tone={testCase.coverage === "covered" ? "green" : testCase.coverage === "partial" ? "amber" : "red"}>
          {testCase.coverage}
        </Badge>
      </div>
      <div className="max-md:mt-3">
        <Badge tone={testCase.riskLevel === "high" ? "red" : testCase.riskLevel === "medium" ? "amber" : "green"}>
          {testCase.riskLevel}
        </Badge>
      </div>
    </article>
  );
}

function InsightCard({
  title,
  label,
  body,
  tone,
}: {
  title: string;
  label: string;
  body: string;
  tone: "red" | "amber" | "green" | "cyan";
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <p className="text-sm leading-6 text-slate-400">{body}</p>
    </article>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-lg font-semibold text-cyan-100">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-400">{text}</p>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "green" | "cyan" }) {
  const classes = {
    red: "bg-red-300/15 text-red-100",
    amber: "bg-amber-300/15 text-amber-100",
    green: "bg-emerald-300/15 text-emerald-100",
    cyan: "bg-cyan-300/15 text-cyan-100",
  };

  return <span className={`rounded px-2 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>;
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


