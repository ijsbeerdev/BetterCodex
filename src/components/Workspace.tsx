import {
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Archive,
  Bolt,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Download,
  Edit3,
  FolderClosed,
  Gauge,
  Hammer,
  Layers3,
  Library,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Palette,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  catalog,
  customizationPrompt,
  defaultEnabledIds,
  defaultInstalledIds,
  getInstalledItems,
  publishPrompt,
  searchCatalog,
  type CatalogItem,
} from "../lib/catalog";

type ConnectionState = "connecting" | "connected" | "offline";
type Role = "user" | "assistant";
type View = "chat" | "library" | "marketplace";
type ChatIntent = "default" | "customize";
type ChatSort = "recent" | "oldest" | "title-asc" | "title-desc";

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  pending?: boolean;
}

interface ThreadSummary {
  id: string;
  name?: string | null;
  preview?: string | null;
  updatedAt?: number;
  cwd?: string;
  gitInfo?: { branch?: string | null } | null;
  status?: { type?: string };
}

interface ProjectSummary {
  id: string;
  cwd: string;
  name: string;
  threads: ThreadSummary[];
}

interface ModelOption {
  id: string;
  model?: string;
  displayName?: string;
  defaultReasoningEffort?: string;
  additionalSpeedTiers?: string[];
  serviceTiers?: Array<{ id: string; name: string; description?: string }>;
  defaultServiceTier?: string | null;
}

interface PendingRequest {
  id: number | string;
  method: string;
  params: Record<string, unknown>;
}

interface ComposerPreferences {
  model: string;
  effort: string;
  approvalPolicy: string;
  fastMode: boolean;
}

interface WorkspaceSession {
  view: View;
  chatIntent: ChatIntent;
  activeThreadId: string | null;
  selectedProjectCwd: string;
  prompt: string;
  messages: ChatMessage[];
  activity: string[];
  expandedProjects: string[];
  recentsExpanded: boolean;
  chatSort: ChatSort;
  projectVisibleCounts: Record<string, number>;
  recentVisibleCount: number;
  searchQuery: string;
}

type ContextTarget =
  | { kind: "project"; project: ProjectSummary }
  | { kind: "thread"; thread: ThreadSummary };

interface ContextMenuState {
  x: number;
  y: number;
  target: ContextTarget;
}

type RenameTarget =
  | { kind: "project"; id: string; currentName: string }
  | { kind: "thread"; id: string; currentName: string };

const thinkingOptions = [
  { value: "low", label: "Low", description: "Faster answers" },
  { value: "medium", label: "Medium", description: "Balanced" },
  { value: "high", label: "High", description: "More analysis" },
  { value: "xhigh", label: "Extra high", description: "Deep reasoning" },
];

const permissionOptions = [
  { value: "on-request", label: "Ask when needed", description: "Approve sensitive actions" },
  { value: "untrusted", label: "Approve trusted", description: "Ask for unfamiliar actions" },
  { value: "never", label: "Never ask", description: "Stay within the sandbox" },
];

const chatSortOptions = [
  { value: "recent", label: "Recently updated", description: "Newest chats first" },
  { value: "oldest", label: "Oldest updated", description: "Oldest chats first" },
  { value: "title-asc", label: "Title A–Z", description: "Alphabetical" },
  { value: "title-desc", label: "Title Z–A", description: "Reverse alphabetical" },
];

const starterThreads: ThreadSummary[] = [
  { id: "demo-1", name: "Build the command palette", updatedAt: Date.now() / 1000 },
  { id: "demo-2", name: "Rethink the settings screen", updatedAt: Date.now() / 1000 - 3600 },
  { id: "demo-3", name: "Add an MCP connection", updatedAt: Date.now() / 1000 - 86_400 },
  { id: "demo-4", name: "Polish the responsive sidebar", updatedAt: Date.now() / 1000 - 90_000 },
  { id: "demo-5", name: "Improve transcript typography", updatedAt: Date.now() / 1000 - 96_000 },
  { id: "demo-6", name: "Persist composer drafts", updatedAt: Date.now() / 1000 - 102_000 },
  { id: "demo-7", name: "Archive completed chats", updatedAt: Date.now() / 1000 - 108_000 },
];

const taskSuggestions = [
  { icon: WandSparkles, label: "Polish this project", prompt: "Review this project and improve its most important rough edges." },
  { icon: Layers3, label: "Add a useful feature", prompt: "Inspect this project and propose one focused, useful feature. Then implement it." },
  { icon: Search, label: "Find the next fix", prompt: "Find the highest-impact bug in this project, explain it briefly, and fix it." },
];

const customizeSuggestions = [
  { icon: Palette, label: "Create a theme", prompt: "Create a calm, low-contrast theme and add it to my Library." },
  { icon: Layers3, label: "Build an add-on", prompt: "Build a project notes add-on and register it in my Library." },
  { icon: WandSparkles, label: "Refine the layout", prompt: "Refine the workspace layout while keeping the interface cozy and add the change to my Library as a mod." },
];

export function titleForThread(thread: ThreadSummary) {
  const title = thread.name || thread.preview || "Untitled task";
  return title.replace(/blacbox/gi, "Blackbox");
}

export function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(please|could you|can you|i want you to|i need you to)\s+/i, "")
    .trim();
  const firstThought = cleaned.split(/(?<=[.!?])\s/)[0] || "Untitled chat";
  if (firstThought.length <= 64) return firstThought.replace(/[.!?]+$/, "");
  const clipped = firstThought.slice(0, 64).replace(/\s+\S*$/, "").trim();
  return clipped || firstThought.slice(0, 64).trim();
}

function orderThreads(threads: ThreadSummary[], order: ChatSort, getTitle: (thread: ThreadSummary) => string) {
  return [...threads].sort((a, b) => {
    if (order === "oldest") return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
    if (order === "title-asc") return getTitle(a).localeCompare(getTitle(b));
    if (order === "title-desc") return getTitle(b).localeCompare(getTitle(a));
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

function messagesMatch(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;
  return a.every((message, index) => message.id === b[index]?.id && message.text === b[index]?.text && message.pending === b[index]?.pending);
}

export function normalizeProjectPath(cwd: string) {
  return cwd.replaceAll("\\", "/").replace(/\/$/, "").toLocaleLowerCase();
}

export function projectName(cwd: string) {
  const clean = cwd.replaceAll("\\", "/").replace(/\/$/, "");
  return clean.split("/").filter(Boolean).at(-1) || clean || "Unassigned";
}

function extractMessages(thread: any): ChatMessage[] {
  const output: ChatMessage[] = [];
  for (const turn of thread?.turns ?? []) {
    for (const item of turn?.items ?? []) {
      if (item?.type === "userMessage") {
        const text = (item.content ?? []).map((part: any) => part.text ?? "").join("");
        if (text) output.push({ id: item.id ?? crypto.randomUUID(), role: "user", text });
      }
      if (item?.type === "agentMessage") {
        const text = item.text ?? (item.content ?? []).map((part: any) => part.text ?? "").join("");
        if (text) output.push({ id: item.id ?? crypto.randomUUID(), role: "assistant", text });
      }
    }
  }
  return output;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>);
    list = [];
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join("\n")}</code></pre>);
    code = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      else flushList();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      list.push(listItem[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) blocks.push(<h4 key={`heading-${blocks.length}`}>{renderInline(heading[1])}</h4>);
    else blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInline(line)}</p>);
  }
  flushList();
  flushCode();
  return <div className="rich-text">{blocks}</div>;
}

function SidebarThreadButton({ title, active, running, projectThread = false, onOpen, onContextMenu }: { title: string; active: boolean; running: boolean; projectThread?: boolean; onOpen: () => void; onContextMenu: (event: React.MouseEvent) => void }) {
  return <button
    className={`thread-row ${projectThread ? "project-thread" : ""} ${active ? "thread-row--active" : ""}`}
    onClick={onOpen}
    onContextMenu={onContextMenu}
    title={title}
  >
    {running && <LoaderCircle className="thread-running" size={13} aria-label="Chat is running" />}
    <span>{title}</span>
  </button>;
}

export default function Workspace() {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [reconnectTick, setReconnectTick] = useState(0);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [localCwd, setLocalCwd] = useState("");
  const [selectedProjectCwd, setSelectedProjectCwd] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [effort, setEffort] = useState("medium");
  const [approvalPolicy, setApprovalPolicy] = useState("on-request");
  const [fastMode, setFastMode] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [chatIntent, setChatIntent] = useState<ChatIntent>("default");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [chatSort, setChatSort] = useState<ChatSort>("recent");
  const [projectVisibleCounts, setProjectVisibleCounts] = useState<Record<string, number>>({});
  const [recentVisibleCount, setRecentVisibleCount] = useState(5);
  const [activity, setActivity] = useState<string[]>([]);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [installedIds, setInstalledIds] = useState<string[]>(defaultInstalledIds);
  const [enabledIds, setEnabledIds] = useState<string[]>(defaultEnabledIds);
  const [activeThemeId, setActiveThemeId] = useState(() => {
    try { return localStorage.getItem("blackbox-active-theme-v1") || "galaxy"; }
    catch { return "galaxy"; }
  });
  const [projectAliases, setProjectAliases] = useState<Record<string, string>>({});
  const [threadAliases, setThreadAliases] = useState<Record<string, string>>({});
  const [hiddenProjectIds, setHiddenProjectIds] = useState<string[]>([]);
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const nextIdRef = useRef(1);
  const pendingRef = useRef(new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>());
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initializedExpandedProjectsRef = useRef(false);
  const savedModelRef = useRef("");
  const activeThreadIdRef = useRef<string | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const updatePrompt = useCallback((value: string) => {
    setPrompt(value);
    try { localStorage.setItem("blackbox-current-draft-v1", value); }
    catch { /* storage can be unavailable in private browsing */ }
  }, []);

  const sendRaw = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Gateway is not connected");
    socket.send(JSON.stringify(payload));
  }, []);

  const rpc = useCallback((method: string, params: Record<string, unknown> = {}) => {
    const id = nextIdRef.current++;
    return new Promise<any>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      try {
        sendRaw({ method, id, params });
      } catch (error) {
        pendingRef.current.delete(id);
        reject(error);
      }
    });
  }, [sendRaw]);

  const loadAllThreads = useCallback(async () => {
    const loaded: ThreadSummary[] = [];
    let cursor: string | null = null;
    let page = 0;
    do {
      const result = await rpc("thread/list", {
        cursor,
        limit: 100,
        sortKey: "updated_at",
        sortDirection: "desc",
        sourceKinds: ["cli", "vscode", "appServer", "exec"],
        archived: false,
      });
      loaded.push(...(result?.data ?? []));
      cursor = result?.nextCursor ?? null;
      page += 1;
    } while (cursor && page < 50);
    return loaded;
  }, [rpc]);

  const readThreadMessages = useCallback(async (threadId: string) => {
    const result = await rpc("thread/read", { threadId, includeTurns: true });
    return { thread: result?.thread as ThreadSummary | undefined, messages: extractMessages(result?.thread) };
  }, [rpc]);

  const addActivity = useCallback((message: string) => {
    setActivity((current) => [message, ...current].slice(0, 5));
  }, []);

  useEffect(() => {
    try {
      const savedIds = localStorage.getItem("blackbox-library-v1");
      const savedEnabledIds = localStorage.getItem("blackbox-library-enabled-v1");
      const savedTheme = localStorage.getItem("blackbox-active-theme-v1");
      const savedComposer = localStorage.getItem("blackbox-composer-preferences-v1");
      const savedNavigation = localStorage.getItem("blackbox-navigation-preferences-v1");
      const savedWorkspace = localStorage.getItem("blackbox-workspace-session-v1");
      const savedDraft = localStorage.getItem("blackbox-current-draft-v1");
      const pureBlackRegistered = localStorage.getItem("blackbox-pure-black-registered-v1");
      const galaxyRegistered = localStorage.getItem("blackbox-galaxy-registered-v1");
      if (savedIds) {
        const parsedIds = JSON.parse(savedIds);
        const idsWithPureBlack = pureBlackRegistered || parsedIds.includes("pure-black") ? parsedIds : ["pure-black", ...parsedIds];
        setInstalledIds(galaxyRegistered || idsWithPureBlack.includes("galaxy") ? idsWithPureBlack : ["galaxy", ...idsWithPureBlack]);
      }
      if (savedEnabledIds) {
        const parsedEnabledIds = JSON.parse(savedEnabledIds);
        setEnabledIds(galaxyRegistered
          ? parsedEnabledIds
          : [...parsedEnabledIds.filter((id: string) => catalog.find((item) => item.id === id)?.kind !== "Theme"), "galaxy"]);
      } else if (savedTheme && galaxyRegistered && pureBlackRegistered) {
        setEnabledIds([...defaultEnabledIds.filter((id) => catalog.find((item) => item.id === id)?.kind !== "Theme"), savedTheme]);
      }
      if (!galaxyRegistered) setActiveThemeId("galaxy");
      else if (savedTheme && pureBlackRegistered) setActiveThemeId(savedTheme);
      if (savedComposer) {
        const preferences = JSON.parse(savedComposer) as Partial<ComposerPreferences>;
        if (typeof preferences.model === "string") {
          savedModelRef.current = preferences.model;
          setSelectedModel(preferences.model);
        }
        if (typeof preferences.effort === "string") setEffort(preferences.effort);
        if (typeof preferences.approvalPolicy === "string") setApprovalPolicy(preferences.approvalPolicy);
        if (typeof preferences.fastMode === "boolean") setFastMode(preferences.fastMode);
      }
      if (savedNavigation) {
        const preferences = JSON.parse(savedNavigation);
        if (preferences.projectAliases) setProjectAliases(preferences.projectAliases);
        if (preferences.threadAliases) setThreadAliases(preferences.threadAliases);
        if (Array.isArray(preferences.hiddenProjectIds)) setHiddenProjectIds(preferences.hiddenProjectIds);
        if (Array.isArray(preferences.hiddenThreadIds)) setHiddenThreadIds(preferences.hiddenThreadIds);
      }
      if (savedWorkspace) {
        const session = JSON.parse(savedWorkspace) as Partial<WorkspaceSession>;
        if (session.view === "chat" || session.view === "library" || session.view === "marketplace") setView(session.view);
        if (session.chatIntent === "default" || session.chatIntent === "customize") setChatIntent(session.chatIntent);
        if (typeof session.activeThreadId === "string" || session.activeThreadId === null) {
          activeThreadIdRef.current = session.activeThreadId ?? null;
          setActiveThreadId(session.activeThreadId ?? null);
        }
        if (typeof session.selectedProjectCwd === "string") setSelectedProjectCwd(session.selectedProjectCwd);
        if (typeof session.prompt === "string") setPrompt(session.prompt);
        if (Array.isArray(session.messages)) setMessages(session.messages.slice(-100));
        if (Array.isArray(session.activity)) setActivity(session.activity.slice(0, 12));
        if (Array.isArray(session.expandedProjects)) {
          setExpandedProjects(new Set(session.expandedProjects));
          initializedExpandedProjectsRef.current = session.expandedProjects.length > 0;
        }
        if (typeof session.recentsExpanded === "boolean") setRecentsExpanded(session.recentsExpanded);
        if (["recent", "oldest", "title-asc", "title-desc"].includes(session.chatSort ?? "")) setChatSort(session.chatSort as ChatSort);
        if (session.projectVisibleCounts) setProjectVisibleCounts(session.projectVisibleCounts);
        if (typeof session.recentVisibleCount === "number") setRecentVisibleCount(Math.max(5, session.recentVisibleCount));
        if (typeof session.searchQuery === "string") setSearchQuery(session.searchQuery);
      }
      if (savedDraft !== null) setPrompt(savedDraft);
      localStorage.setItem("blackbox-pure-black-registered-v1", "true");
      localStorage.setItem("blackbox-galaxy-registered-v1", "true");
    } catch { /* keep safe defaults */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = activeThemeId;
    document.documentElement.dataset.quietComposer = enabledIds.includes("quiet-composer") ? "true" : "false";
    if (!storageReady) return;
    localStorage.setItem("blackbox-library-v1", JSON.stringify(installedIds));
    localStorage.setItem("blackbox-library-enabled-v1", JSON.stringify(enabledIds));
    localStorage.setItem("blackbox-active-theme-v1", activeThemeId);
  }, [activeThemeId, enabledIds, installedIds, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    const persist = () => localStorage.setItem("blackbox-composer-preferences-v1", JSON.stringify({ model: selectedModel, effort, approvalPolicy, fastMode } satisfies ComposerPreferences));
    persist();
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [approvalPolicy, effort, fastMode, selectedModel, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("blackbox-navigation-preferences-v1", JSON.stringify({ projectAliases, threadAliases, hiddenProjectIds, hiddenThreadIds }));
  }, [hiddenProjectIds, hiddenThreadIds, projectAliases, storageReady, threadAliases]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    activeTurnIdRef.current = activeTurnId;
  }, [activeTurnId]);

  useEffect(() => {
    if (!storageReady) return;
    const persist = () => localStorage.setItem("blackbox-workspace-session-v1", JSON.stringify({
      view,
      chatIntent,
      activeThreadId,
      selectedProjectCwd,
      prompt,
      messages: messages.slice(-100).map((message) => ({ ...message, pending: false })),
      activity: activity.slice(0, 12),
      expandedProjects: [...expandedProjects],
      recentsExpanded,
      chatSort,
      projectVisibleCounts,
      recentVisibleCount,
      searchQuery,
    } satisfies WorkspaceSession));
    const timer = window.setTimeout(persist, 100);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [activeThreadId, activity, chatIntent, chatSort, expandedProjects, messages, projectVisibleCounts, prompt, recentVisibleCount, recentsExpanded, searchQuery, selectedProjectCwd, storageReady, view]);

  useEffect(() => {
    const gatewayUrl = import.meta.env.PUBLIC_GATEWAY_URL || "ws://127.0.0.1:8787";
    let closedIntentionally = false;
    let reconnectTimer: number | undefined;
    setConnection("connecting");
    const socket = new WebSocket(gatewayUrl);
    socketRef.current = socket;

    socket.onopen = async () => {
      try {
        const initId = nextIdRef.current++;
        const initialized = new Promise<void>((resolve, reject) => pendingRef.current.set(initId, { resolve, reject }));
        sendRaw({ method: "initialize", id: initId, params: { clientInfo: { name: "blackbox", title: "Blackbox", version: "0.1.0" } } });
        await initialized;
        sendRaw({ method: "initialized", params: {} });
        setConnection("connected");

        const [allThreads, modelResult] = await Promise.all([loadAllThreads(), rpc("model/list", {})]);
        setThreads(allThreads);
        const availableModels = modelResult?.data ?? [];
        setModels(availableModels);
        const savedModel = availableModels.find((model: any) => (model.id ?? model.model) === savedModelRef.current);
        const defaultModel = savedModel ?? availableModels.find((model: any) => model.isDefault) ?? availableModels[0];
        if (defaultModel) setSelectedModel(defaultModel.id ?? defaultModel.model);
        const restoredThreadId = activeThreadIdRef.current;
        if (restoredThreadId && !restoredThreadId.startsWith("demo-")) {
          try {
            await rpc("thread/resume", { threadId: restoredThreadId });
            const restored = await readThreadMessages(restoredThreadId);
            setMessages((current) => messagesMatch(current, restored.messages) ? current : restored.messages);
            if (restored.thread?.status?.type === "active") setStreaming(true);
          } catch { /* keep the persisted transcript if the source chat is unavailable */ }
        }
      } catch (error) {
        console.error(error);
        setConnection("offline");
        setToast(error instanceof Error ? error.message : "Could not initialize Codex");
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      let message: any;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.id !== undefined && !message.method) {
        const pending = pendingRef.current.get(message.id);
        if (pending) {
          pendingRef.current.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message ?? "Codex request failed"));
          else pending.resolve(message.result);
        }
        return;
      }

      if (message.id !== undefined && message.method) {
        setPendingRequest({ id: message.id, method: message.method, params: message.params ?? {} });
        return;
      }

      const params = message.params ?? {};
      switch (message.method) {
        case "_blackbox/ready":
          if (typeof params.cwd === "string") setLocalCwd(params.cwd);
          break;
        case "_blackbox/error":
          setToast(params.message ?? "The local Codex gateway reported an error");
          break;
        case "item/agentMessage/delta": {
          if (params.threadId && params.threadId !== activeThreadIdRef.current) break;
          const delta = params.delta ?? "";
          setMessages((current) => {
            const index = current.findLastIndex((item) => item.role === "assistant" && item.pending);
            if (index < 0) return [...current, { id: crypto.randomUUID(), role: "assistant", text: delta, pending: true }];
            const next = [...current];
            next[index] = { ...next[index], text: next[index].text + delta };
            return next;
          });
          break;
        }
        case "turn/started":
          if (params.threadId && params.threadId !== activeThreadIdRef.current) break;
          setStreaming(true);
          setActiveTurnId(params.turn?.id ?? null);
          addActivity("Codex started working");
          break;
        case "turn/completed":
          if (params.threadId && params.threadId !== activeThreadIdRef.current) break;
          setStreaming(false);
          setActiveTurnId(null);
          setMessages((current) => current.map((item) => item.pending ? { ...item, pending: false } : item));
          addActivity(params.turn?.status === "failed" ? "Turn failed" : "Turn completed");
          break;
        case "item/started": {
          if (params.threadId && params.threadId !== activeThreadIdRef.current) break;
          const itemType = params.item?.type;
          if (itemType === "commandExecution") addActivity(`Running ${params.item.command ?? "a command"}`);
          if (itemType === "fileChange") addActivity("Editing files");
          if (itemType === "mcpToolCall") addActivity(`Using ${params.item.tool ?? "a tool"}`);
          break;
        }
        case "thread/name/updated":
          setThreads((current) => current.map((item) => item.id === params.threadId ? { ...item, name: params.name } : item));
          break;
        case "thread/status/changed":
          setThreads((current) => current.map((item) => item.id === params.threadId ? { ...item, status: params.status } : item));
          if (params.threadId === activeThreadIdRef.current) setStreaming(params.status?.type === "active");
          break;
        case "thread/archived":
          setThreads((current) => current.filter((item) => item.id !== params.threadId));
          if (params.threadId === activeThreadIdRef.current) {
            setActiveThreadId(null);
            setMessages([]);
            setActivity([]);
          }
          break;
      }
    };

    socket.onerror = () => setConnection("offline");
    socket.onclose = () => {
      for (const pending of pendingRef.current.values()) pending.reject(new Error("Gateway disconnected"));
      pendingRef.current.clear();
      if (!closedIntentionally) {
        setConnection("offline");
        reconnectTimer = window.setTimeout(() => setReconnectTick((value) => value + 1), 1500);
      }
    };

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket.close();
    };
  }, [addActivity, loadAllThreads, readThreadMessages, reconnectTick, rpc, sendRaw]);

  useEffect(() => {
    if (connection !== "connected") return;
    let disposed = false;

    const refresh = async () => {
      if (disposed || refreshInFlightRef.current || document.visibilityState === "hidden") return;
      refreshInFlightRef.current = true;
      try {
        const result = await rpc("thread/list", {
          limit: 100,
          sortKey: "updated_at",
          sortDirection: "desc",
          sourceKinds: ["cli", "vscode", "appServer", "exec"],
          archived: false,
          useStateDbOnly: true,
        });
        const latest = (result?.data ?? []) as ThreadSummary[];
        if (disposed) return;
        setThreads(latest);

        const threadId = activeThreadIdRef.current;
        if (threadId && !threadId.startsWith("demo-") && !activeTurnIdRef.current) {
          const refreshed = await readThreadMessages(threadId);
          if (!disposed) {
            setMessages((current) => messagesMatch(current, refreshed.messages) ? current : refreshed.messages);
            setStreaming(refreshed.thread?.status?.type === "active");
          }
        }
      } catch { /* the reconnect loop handles gateway failures */ }
      finally { refreshInFlightRef.current = false; }
    };

    const interval = window.setInterval(refresh, 2500);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connection, readThreadMessages, rpc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setView("chat");
        setChatIntent("default");
        setActiveThreadId(null);
        setMessages([]);
        updatePrompt("");
        setActivity([]);
        setMobileNavOpen(false);
        window.setTimeout(() => promptRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setContextMenu(null);
        setRenameTarget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [updatePrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sourceThreads = useMemo(
    () => threads.length ? threads : connection === "offline" ? starterThreads.map((thread) => ({ ...thread, cwd: localCwd || "Preview" })) : [],
    [connection, localCwd, threads],
  );

  const availableThreads = useMemo(
    () => sourceThreads.filter((thread) => !hiddenThreadIds.includes(thread.id) && !hiddenProjectIds.includes(normalizeProjectPath(thread.cwd || "Unassigned"))),
    [hiddenProjectIds, hiddenThreadIds, sourceThreads],
  );

  const displayThreadTitle = useCallback(
    (thread: ThreadSummary) => threadAliases[thread.id] || titleForThread(thread),
    [threadAliases],
  );

  const projects = useMemo<ProjectSummary[]>(() => {
    const grouped = new Map<string, ProjectSummary>();
    for (const thread of availableThreads) {
      const cwd = thread.cwd || "Unassigned";
      const id = normalizeProjectPath(cwd);
      const existing = grouped.get(id);
      if (existing) existing.threads.push(thread);
      else grouped.set(id, { id, cwd, name: projectAliases[id] || projectName(cwd), threads: [thread] });
    }
    if (localCwd) {
      const localId = normalizeProjectPath(localCwd);
      if (!grouped.has(localId) && !hiddenProjectIds.includes(localId)) grouped.set(localId, { id: localId, cwd: localCwd, name: projectAliases[localId] || projectName(localCwd), threads: [] });
    }
    return [...grouped.values()].sort((a, b) => {
      if (localCwd && a.id === normalizeProjectPath(localCwd)) return -1;
      if (localCwd && b.id === normalizeProjectPath(localCwd)) return 1;
      return (b.threads[0]?.updatedAt ?? 0) - (a.threads[0]?.updatedAt ?? 0);
    });
  }, [availableThreads, hiddenProjectIds, localCwd, projectAliases]);

  useEffect(() => {
    if (!projects.length) return;
    const selectedStillExists = projects.some((project) => project.id === normalizeProjectPath(selectedProjectCwd));
    if (!selectedProjectCwd || !selectedStillExists) {
      const localProject = localCwd ? projects.find((project) => project.id === normalizeProjectPath(localCwd)) : undefined;
      setSelectedProjectCwd((localProject ?? projects[0]).cwd);
    }
  }, [localCwd, projects, selectedProjectCwd]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === normalizeProjectPath(selectedProjectCwd)) ?? projects[0],
    [projects, selectedProjectCwd],
  );

  useEffect(() => {
    if (initializedExpandedProjectsRef.current || !selectedProject) return;
    initializedExpandedProjectsRef.current = true;
    setExpandedProjects(new Set([selectedProject.id]));
  }, [selectedProject]);

  const recentThreads = useMemo(() => orderThreads(availableThreads, chatSort, displayThreadTitle), [availableThreads, chatSort, displayThreadTitle]);
  const activeThread = useMemo(() => availableThreads.find((thread) => thread.id === activeThreadId), [activeThreadId, availableThreads]);
  const installedItems = useMemo(() => getInstalledItems(installedIds), [installedIds]);
  const currentModelOption = useMemo(() => models.find((item) => (item.id ?? item.model) === selectedModel), [models, selectedModel]);
  const currentModel = currentModelOption?.displayName ?? currentModelOption?.id ?? currentModelOption?.model ?? "Codex default";
  const advertisedFastTier = useMemo(
    () => currentModelOption?.serviceTiers?.find((tier) => /fast|priority/i.test(`${tier.id} ${tier.name}`))?.id
      ?? currentModelOption?.additionalSpeedTiers?.find((tier) => /fast|priority/i.test(tier))
      ?? null,
    [currentModelOption],
  );
  const fastAvailable = models.length === 0 || !currentModelOption || Boolean(advertisedFastTier);
  const fastServiceTier = advertisedFastTier ?? "fast";

  const newTask = useCallback(() => {
    setView("chat");
    setChatIntent("default");
    setActiveThreadId(null);
    setMessages([]);
    updatePrompt("");
    setActivity([]);
    setMobileNavOpen(false);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, [updatePrompt]);

  const startCustomizeChat = useCallback((initialPrompt = "") => {
    setView("chat");
    setChatIntent("customize");
    setActiveThreadId(null);
    setMessages([]);
    updatePrompt(initialPrompt);
    setActivity([]);
    setMobileNavOpen(false);
    setSearchOpen(false);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, [updatePrompt]);

  const navigate = (nextView: View) => {
    setView(nextView);
    setMobileNavOpen(false);
    setSearchOpen(false);
  };

  const openContextMenu = (event: React.MouseEvent, target: ContextTarget) => {
    event.preventDefault();
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 224),
      y: Math.min(event.clientY, window.innerHeight - 220),
      target,
    });
  };

  const beginRename = (target: RenameTarget) => {
    setContextMenu(null);
    setRenameTarget(target);
    setRenameValue(target.currentName);
  };

  const saveRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const name = renameValue.trim();
    if (renameTarget.kind === "project") {
      setProjectAliases((current) => ({ ...current, [renameTarget.id]: name }));
      setToast("Project name updated");
    } else {
      setThreadAliases((current) => ({ ...current, [renameTarget.id]: name }));
      setThreads((current) => current.map((thread) => thread.id === renameTarget.id ? { ...thread, name } : thread));
      if (connection === "connected" && !renameTarget.id.startsWith("demo-")) {
        try { await rpc("thread/name/set", { threadId: renameTarget.id, name }); }
        catch { setToast("Name saved locally; Codex could not update the source chat"); }
      } else {
        setToast("Chat name updated");
      }
    }
    setRenameTarget(null);
  };

  const hideProject = (project: ProjectSummary) => {
    setHiddenProjectIds((current) => current.includes(project.id) ? current : [...current, project.id]);
    setContextMenu(null);
    setToast(`${project.name} removed from the sidebar`);
  };

  const hideThread = (thread: ThreadSummary) => {
    setHiddenThreadIds((current) => current.includes(thread.id) ? current : [...current, thread.id]);
    setContextMenu(null);
    if (activeThreadId === thread.id) newTask();
    setToast("Chat removed from the sidebar");
  };

  const archiveThread = async (thread: ThreadSummary) => {
    setContextMenu(null);
    if (thread.id.startsWith("demo-") || connection !== "connected") {
      hideThread(thread);
      setToast("Chat archived locally");
      return;
    }
    try {
      await rpc("thread/archive", { threadId: thread.id });
      setThreads((current) => current.filter((item) => item.id !== thread.id));
      if (activeThreadIdRef.current === thread.id) newTask();
      setToast("Chat archived");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not archive chat");
    }
  };

  const toggleProject = (project: ProjectSummary) => {
    setSelectedProjectCwd(project.cwd);
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(project.id)) next.delete(project.id);
      else next.add(project.id);
      return next;
    });
  };

  const openThread = async (thread: ThreadSummary) => {
    setView("chat");
    setChatIntent("default");
    setSearchOpen(false);
    setMobileNavOpen(false);
    if (thread.cwd) {
      setSelectedProjectCwd(thread.cwd);
      setExpandedProjects((current) => new Set(current).add(normalizeProjectPath(thread.cwd || "Unassigned")));
    }
    if (thread.id.startsWith("demo-")) {
      activeThreadIdRef.current = thread.id;
      setActiveThreadId(thread.id);
      setMessages([
        { id: "d1", role: "user", text: titleForThread(thread) },
        { id: "d2", role: "assistant", text: "This is a preview task. Start the local gateway to load your real Codex history and continue working here." },
      ]);
      return;
    }
    try {
      activeThreadIdRef.current = thread.id;
      setActiveThreadId(thread.id);
      setMessages([]);
      await rpc("thread/resume", { threadId: thread.id });
      const result = await readThreadMessages(thread.id);
      setMessages(result.messages);
      setStreaming(result.thread?.status?.type === "active");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not open task");
    }
  };

  const submitPrompt = async (text = prompt) => {
    const value = text.trim();
    if (!value || streaming) return;
    const outbound = chatIntent === "customize"
      ? `${value}\n\nFollow the fast customization contract in docs/ADDON_AUTHORING.md. Keep the result cozy, registered in Library, editable, and removable.`
      : value;

    if (connection !== "connected") {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text: value },
        { id: crypto.randomUUID(), role: "assistant", text: "The interface is ready, but the local Codex gateway is offline. Run `npm run dev` to connect your Codex account and start real tasks." },
      ]);
      updatePrompt("");
      return;
    }

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    updatePrompt("");
    setStreaming(true);

    try {
      let threadId = activeThreadId;
      const taskCwd = selectedProject?.cwd || localCwd || ".";
      if (!threadId) {
        const started = await rpc("thread/start", {
          ...(selectedModel ? { model: selectedModel } : {}),
          ...(fastMode && fastAvailable ? { serviceTier: fastServiceTier } : {}),
          cwd: taskCwd,
        });
        threadId = started?.thread?.id;
        if (!threadId) throw new Error("Codex did not return a thread id");
        activeThreadIdRef.current = threadId;
        setActiveThreadId(threadId);
        const generatedTitle = titleFromPrompt(value);
        setThreads((current) => [{ ...started.thread, id: threadId, cwd: started.thread?.cwd ?? taskCwd, name: generatedTitle, updatedAt: Date.now() / 1000, status: { type: "active" } }, ...current]);
        void rpc("thread/name/set", { threadId, name: generatedTitle }).catch(() => undefined);
      }

      const result = await rpc("turn/start", {
        threadId,
        input: [{ type: "text", text: outbound }],
        ...(selectedModel ? { model: selectedModel } : {}),
        ...(fastMode && fastAvailable ? { serviceTier: fastServiceTier } : { serviceTier: null }),
        effort,
        approvalPolicy,
        cwd: taskCwd,
        sandboxPolicy: { type: "workspaceWrite", networkAccess: false },
      });
      setActiveTurnId(result?.turn?.id ?? null);
    } catch (error) {
      setStreaming(false);
      const message = error instanceof Error ? error.message : "Could not start task";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `Could not start this task: ${message}` }]);
      setToast(message);
    }
  };

  const interrupt = async () => {
    if (!activeThreadId || !activeTurnId) return;
    try { await rpc("turn/interrupt", { threadId: activeThreadId, turnId: activeTurnId }); } catch { /* events reconcile state */ }
  };

  const answerRequest = (approved: boolean) => {
    if (!pendingRequest) return;
    sendRaw({ id: pendingRequest.id, result: approved ? { decision: "accept" } : { decision: "decline" } });
    addActivity(approved ? "Approved requested action" : "Declined requested action");
    setPendingRequest(null);
  };

  const installItem = (item: CatalogItem) => {
    setInstalledIds((current) => current.includes(item.id) ? current : [...current, item.id]);
    setEnabledIds((current) => item.kind === "Theme"
      ? [...current.filter((id) => catalog.find((candidate) => candidate.id === id)?.kind !== "Theme"), item.id]
      : current.includes(item.id) ? current : [...current, item.id]);
    if (item.kind === "Theme") setActiveThemeId(item.id);
    setToast(`${item.name} added to your Library`);
  };

  const toggleItem = (item: CatalogItem) => {
    const enabled = enabledIds.includes(item.id);
    if (enabled) {
      setEnabledIds((current) => current.filter((id) => id !== item.id));
      if (item.kind === "Theme" && activeThemeId === item.id) setActiveThemeId("default");
      setToast(`${item.name} disabled`);
      return;
    }
    setEnabledIds((current) => item.kind === "Theme"
      ? [...current.filter((id) => catalog.find((candidate) => candidate.id === id)?.kind !== "Theme"), item.id]
      : [...current, item.id]);
    if (item.kind === "Theme") setActiveThemeId(item.id);
    setToast(`${item.name} enabled`);
  };

  const removeItem = (item: CatalogItem) => {
    setInstalledIds((current) => current.filter((id) => id !== item.id));
    setEnabledIds((current) => current.filter((id) => id !== item.id));
    if (activeThemeId === item.id) setActiveThemeId("default");
    setToast(`${item.name} removed`);
  };

  const pageTitle = view === "library" ? "Library" : view === "marketplace" ? "Marketplace" : activeThread ? displayThreadTitle(activeThread) : chatIntent === "customize" ? "Customize Blackbox" : "New chat";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar--mobile-open" : ""}`}>
        <div className="brand-row">
          <button className="brand" onClick={newTask} aria-label="Blackbox home"><span>Blackbox</span></button>
          <button className="icon-button sidebar-search" onClick={() => { setSearchOpen(true); window.setTimeout(() => searchInputRef.current?.focus(), 0); }} aria-label="Search"><Search size={17} /></button>
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button className={`nav-item ${view === "chat" && chatIntent === "default" && !activeThreadId ? "nav-item--active" : ""}`} onClick={newTask}><MessageSquarePlus size={17} /><span>New chat</span></button>
          <button className={`nav-item ${view === "chat" && chatIntent === "customize" ? "nav-item--active" : ""}`} onClick={() => startCustomizeChat()}><Palette size={17} /><span>Customize</span></button>
          <button className={`nav-item ${view === "library" ? "nav-item--active" : ""}`} onClick={() => navigate("library")}><Library size={17} /><span>Library</span><small>{installedItems.length}</small></button>
          <button className={`nav-item ${view === "marketplace" ? "nav-item--active" : ""}`} onClick={() => navigate("marketplace")}><ShoppingBag size={17} /><span>Marketplace</span></button>
        </nav>

        <div className="sidebar-section projects-section">
          <div className="sidebar-section-heading">
            <div className="section-label">Projects</div>
            <CustomDropdown ariaLabel="Project chat order" className="sidebar-sort" icon={<ArrowUpDown size={13} />} value={chatSort} options={chatSortOptions} onChange={(value) => setChatSort(value as ChatSort)} />
          </div>
          <div className="project-list">
            {projects.map((project) => {
              const expanded = expandedProjects.has(project.id);
              const orderedProjectThreads = orderThreads(project.threads, chatSort, displayThreadTitle);
              const visibleCount = projectVisibleCounts[project.id] ?? 5;
              return <div className={`project-group ${expanded ? "project-group--expanded" : ""}`} key={project.id}>
                <button className={`workspace-row ${selectedProject?.id === project.id ? "workspace-row--active" : ""}`} onClick={() => toggleProject(project)} onContextMenu={(event) => openContextMenu(event, { kind: "project", project })} title={`${project.cwd} · Right-click for options`} aria-expanded={expanded}>
                  <ChevronRight className="project-chevron" size={15} />
                  <FolderClosed size={16} />
                  <strong>{project.name}</strong>
                  <span className="project-count">{project.threads.length}</span>
                </button>
                <div className={`project-thread-panel ${expanded ? "project-thread-panel--open" : ""}`} aria-hidden={!expanded}>
                  <div className="project-thread-panel-inner"><div className="project-thread-list">
                    {orderedProjectThreads.slice(0, visibleCount).map((thread) => <SidebarThreadButton key={thread.id} title={displayThreadTitle(thread)} active={activeThreadId === thread.id} running={thread.status?.type === "active" || (activeThreadId === thread.id && streaming)} projectThread onOpen={() => openThread(thread)} onContextMenu={(event) => openContextMenu(event, { kind: "thread", thread })} />)}
                    {orderedProjectThreads.length > visibleCount && <button className="show-more-button project-show-more" onClick={() => setProjectVisibleCounts((current) => ({ ...current, [project.id]: visibleCount + 5 }))}>Show 5 more <span>{orderedProjectThreads.length - visibleCount}</span></button>}
                    {project.threads.length === 0 && <p className="empty-thread-list">No chats yet.</p>}
                  </div></div>
                </div>
              </div>;
            })}
          </div>
        </div>

        <div className={`sidebar-section recents-section ${recentsExpanded ? "recents-section--expanded" : ""}`}>
          <div className="sidebar-section-heading">
            <button className="section-label section-toggle" onClick={() => setRecentsExpanded((value) => !value)} aria-expanded={recentsExpanded}><span>Recent chats</span><ChevronRight className="section-chevron" size={15} /></button>
            <CustomDropdown ariaLabel="Recent chat order" className="sidebar-sort" icon={<ArrowUpDown size={13} />} value={chatSort} options={chatSortOptions} onChange={(value) => setChatSort(value as ChatSort)} />
          </div>
          <div className={`recent-panel ${recentsExpanded ? "recent-panel--open" : ""}`}>
            <div className="recent-panel-inner"><div className="thread-list">
              {recentThreads.slice(0, recentVisibleCount).map((thread) => <SidebarThreadButton key={thread.id} title={displayThreadTitle(thread)} active={activeThreadId === thread.id} running={thread.status?.type === "active" || (activeThreadId === thread.id && streaming)} onOpen={() => openThread(thread)} onContextMenu={(event) => openContextMenu(event, { kind: "thread", thread })} />)}
              {recentThreads.length > recentVisibleCount && <button className="show-more-button" onClick={() => setRecentVisibleCount((current) => current + 5)}>Show 5 more <span>{recentThreads.length - recentVisibleCount}</span></button>}
              {recentThreads.length === 0 && <p className="empty-thread-list">Your recent chats will appear here.</p>}
            </div></div>
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="avatar">A</span>
          <span className="account-copy"><strong>Local Codex</strong><small>{connection === "connected" ? "Ready" : "Gateway offline"}</small></span>
          <span className={`account-status account-status--${connection}`} />
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            {view === "library" ? <Library size={16} /> : view === "marketplace" ? <ShoppingBag size={16} /> : chatIntent === "customize" ? <Palette size={16} /> : <FolderClosed size={16} />}
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection-dot connection-dot--${connection}`} title={connection === "connected" ? "Codex connected" : connection} />
            {view !== "chat" && <button className="topbar-text-button" onClick={() => startCustomizeChat(view === "library" ? "Create a new customization for my Library." : publishPrompt())}>{view === "library" ? "Create with chat" : "Share yours"}<ArrowRight size={14} /></button>}
          </div>
        </header>

        {view === "library" ? (
          <LibraryView items={installedItems} enabledIds={enabledIds} onToggle={toggleItem} onCustomize={(item) => startCustomizeChat(customizationPrompt(item))} onRemove={removeItem} onBrowse={() => navigate("marketplace")} />
        ) : view === "marketplace" ? (
          <MarketplaceView installedIds={installedIds} onInstall={installItem} onOpenLibrary={() => navigate("library")} onPublish={() => startCustomizeChat(publishPrompt())} />
        ) : (
          <section className={`conversation ${messages.length ? "conversation--active" : ""}`}>
            {messages.length === 0 ? (
              <div className={`empty-state ${chatIntent === "customize" ? "empty-state--customize" : ""}`}>
                <span className="eyebrow">{chatIntent === "customize" ? "Chat-first customization" : selectedProject ? `Project · ${selectedProject.name}` : "Local workspace"}</span>
                <h1>{chatIntent === "customize" ? "Customize Blackbox in chat" : "What should we build?"}</h1>
                <p>{chatIntent === "customize" ? "Describe the change you want. Codex will build it, test it, and keep it manageable in your Library." : "Ask Codex to change the code, trace a bug, or ship the next idea."}</p>
                <Composer prompt={prompt} setPrompt={updatePrompt} submitPrompt={submitPrompt} promptRef={promptRef} streaming={streaming} interrupt={interrupt} currentModel={currentModel} models={models} selectedModel={selectedModel} setSelectedModel={setSelectedModel} effort={effort} setEffort={setEffort} approvalPolicy={approvalPolicy} setApprovalPolicy={setApprovalPolicy} fastMode={fastMode} setFastMode={setFastMode} fastAvailable={fastAvailable} placeholder={chatIntent === "customize" ? "Describe your theme, add-on, or mod…" : "Ask Blackbox anything…"} />
                <div className="suggestion-grid">
                  {(chatIntent === "customize" ? customizeSuggestions : taskSuggestions).map((suggestion) => <button key={suggestion.label} onClick={() => { updatePrompt(suggestion.prompt); promptRef.current?.focus(); }}><suggestion.icon size={16} /><span>{suggestion.label}</span><ArrowUp size={14} /></button>)}
                </div>
              </div>
            ) : (
              <div className="message-view">
                <div className="messages">
                  {messages.map((message) => <article key={message.id} className={`message message--${message.role}`}><div className="message-body"><div className="message-text"><RichText text={message.text} />{message.pending && <span className="typing-cursor" />}</div></div></article>)}
                  {activity.length > 0 && <div className="transcript-activity" aria-label="Task activity">{activity.slice(0, 8).reverse().map((entry, index) => <div key={`${entry}-${index}`}><CircleDot size={14} /><span>{entry}</span></div>)}</div>}
                  {streaming && !messages.some((message) => message.pending) && <article className="message message--assistant"><div className="thinking"><LoaderCircle size={15} /> Working…</div></article>}
                  <div ref={messagesEndRef} />
                </div>
                <div className="docked-composer"><Composer prompt={prompt} setPrompt={updatePrompt} submitPrompt={submitPrompt} promptRef={promptRef} streaming={streaming} interrupt={interrupt} currentModel={currentModel} models={models} selectedModel={selectedModel} setSelectedModel={setSelectedModel} effort={effort} setEffort={setEffort} approvalPolicy={approvalPolicy} setApprovalPolicy={setApprovalPolicy} fastMode={fastMode} setFastMode={setFastMode} fastAvailable={fastAvailable} placeholder={chatIntent === "customize" ? "Continue customizing…" : "Reply to Blackbox…"} compact /></div>
              </div>
            )}
          </section>
        )}
      </main>

      {searchOpen && <SearchDialog query={searchQuery} setQuery={setSearchQuery} threads={availableThreads} installedItems={installedItems} inputRef={searchInputRef} onClose={() => setSearchOpen(false)} onOpenThread={openThread} onNavigate={navigate} getThreadTitle={displayThreadTitle} />}

      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} onOpenThread={openThread} onNewProjectChat={(project) => { setSelectedProjectCwd(project.cwd); newTask(); }} onRename={beginRename} onHideProject={hideProject} onArchiveThread={archiveThread} onCustomizeProject={(project) => startCustomizeChat(`Customize the ${project.name} project experience. Keep the result registered in my Library.`)} onCopyPath={async (project) => { await navigator.clipboard.writeText(project.cwd); setContextMenu(null); setToast("Project path copied"); }} getThreadTitle={displayThreadTitle} />}

      {renameTarget && <RenameDialog target={renameTarget} value={renameValue} setValue={setRenameValue} onClose={() => setRenameTarget(null)} onSave={saveRename} />}

      {pendingRequest && <div className="approval-card" role="alertdialog" aria-label="Codex approval request"><span className="approval-icon"><TerminalSquare size={18} /></span><div><strong>Codex needs approval</strong><p>{pendingRequest.method.replaceAll("/", " ")}</p></div><button className="button button--quiet" onClick={() => answerRequest(false)}>Decline</button><button className="button button--primary" onClick={() => answerRequest(true)}>Approve</button></div>}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

interface ComposerProps {
  prompt: string;
  setPrompt: (value: string) => void;
  submitPrompt: (value?: string) => void;
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  streaming: boolean;
  interrupt: () => void;
  currentModel: string;
  models: ModelOption[];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  effort: string;
  setEffort: (value: string) => void;
  approvalPolicy: string;
  setApprovalPolicy: (value: string) => void;
  fastMode: boolean;
  setFastMode: (value: boolean) => void;
  fastAvailable: boolean;
  placeholder: string;
  compact?: boolean;
}

function Composer({ prompt, setPrompt, submitPrompt, promptRef, streaming, interrupt, currentModel, models, selectedModel, setSelectedModel, effort, setEffort, approvalPolicy, setApprovalPolicy, fastMode, setFastMode, fastAvailable, placeholder, compact }: ComposerProps) {
  const modelOptions = models.length
    ? models.map((model) => ({ value: model.id ?? model.model ?? "", label: model.displayName ?? model.id ?? model.model ?? "Model" }))
    : [{ value: selectedModel, label: selectedModel || currentModel }];
  return <div className={`composer ${compact ? "composer--compact" : ""}`}>
    <textarea ref={promptRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitPrompt(); } }} rows={compact ? 2 : 3} placeholder={placeholder} aria-label="Chat message" />
    <div className="composer-footer">
      <div className="composer-tools">
        <CustomDropdown ariaLabel="Model" icon={<Sparkles size={14} />} value={selectedModel} fallbackLabel={currentModel} options={modelOptions} onChange={setSelectedModel} />
        <CustomDropdown ariaLabel="Thinking" icon={<Gauge size={14} />} value={effort} options={thinkingOptions} onChange={setEffort} />
        <CustomDropdown ariaLabel="Permissions" className="permission-select" icon={<Hammer size={14} />} value={approvalPolicy} options={permissionOptions} onChange={setApprovalPolicy} />
        <button className={`fast-mode-button ${fastMode ? "fast-mode-button--active" : ""}`} onClick={() => setFastMode(!fastMode)} disabled={!fastAvailable} aria-label="Fast mode" aria-pressed={fastMode} title={fastAvailable ? "Fast mode · 1.5× speed with higher credit use" : "Fast mode is unavailable for this model"}><Bolt size={14} fill={fastMode ? "currentColor" : "none"} /><span>Fast</span></button>
      </div>
      {streaming ? <button className="send-button send-button--stop" onClick={interrupt} aria-label="Stop task"><Square size={12} fill="currentColor" /></button> : <button className="send-button" onClick={() => submitPrompt()} disabled={!prompt.trim()} aria-label="Send message"><ArrowUp size={17} /></button>}
    </div>
  </div>;
}

interface DropdownOption {
  value: string;
  label: string;
  description?: string;
}

function CustomDropdown({ ariaLabel, icon, value, fallbackLabel, options, onChange, className = "" }: { ariaLabel: string; icon: ReactNode; value: string; fallbackLabel?: string; options: DropdownOption[]; onChange: (value: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return <div className={`custom-select ${className}`} ref={rootRef}>
    <button className="select-button" type="button" aria-label={`${ariaLabel}: ${selected?.label ?? fallbackLabel ?? value}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{icon}<span>{selected?.label ?? fallbackLabel ?? value}</span><ChevronDown size={13} /></button>
    {open && <div className="select-menu" role="listbox" aria-label={ariaLabel}>
      <div className="select-menu-label">{ariaLabel}</div>
      {options.map((option) => <button key={option.value || option.label} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>{option.value === value && <Check size={14} />}</button>)}
    </div>}
  </div>;
}

function ContextMenu({ state, onClose, onOpenThread, onNewProjectChat, onRename, onHideProject, onArchiveThread, onCustomizeProject, onCopyPath, getThreadTitle }: { state: ContextMenuState; onClose: () => void; onOpenThread: (thread: ThreadSummary) => void; onNewProjectChat: (project: ProjectSummary) => void; onRename: (target: RenameTarget) => void; onHideProject: (project: ProjectSummary) => void; onArchiveThread: (thread: ThreadSummary) => void; onCustomizeProject: (project: ProjectSummary) => void; onCopyPath: (project: ProjectSummary) => void; getThreadTitle: (thread: ThreadSummary) => string }) {
  const target = state.target;
  if (target.kind === "project") {
    const project = target.project;
    return <div className="context-menu-layer">
      <button className="context-menu-scrim" aria-label="Close context menu" onClick={onClose} />
      <div className="context-menu" role="menu" aria-label="Project options" style={{ left: state.x, top: state.y }}>
        <div className="context-menu-heading"><span>{project.name}</span><MoreHorizontal size={15} /></div>
        <button role="menuitem" onClick={() => onNewProjectChat(project)}><MessageSquarePlus size={15} /><span>New chat here</span></button>
        <button role="menuitem" onClick={() => onRename({ kind: "project", id: project.id, currentName: project.name })}><Edit3 size={15} /><span>Rename project</span></button>
        <button role="menuitem" onClick={() => onCustomizeProject(project)}><Sparkles size={15} /><span>Customize project</span></button>
        <button role="menuitem" onClick={() => onCopyPath(project)}><FolderClosed size={15} /><span>Copy project path</span></button>
        <div className="context-menu-separator" />
        <button role="menuitem" className="context-menu-danger" onClick={() => onHideProject(project)}><Trash2 size={15} /><span>Remove from sidebar</span></button>
      </div>
    </div>;
  }

  const thread = target.thread;
  const title = getThreadTitle(thread);
  return <div className="context-menu-layer">
    <button className="context-menu-scrim" aria-label="Close context menu" onClick={onClose} />
    <div className="context-menu" role="menu" aria-label="Chat options" style={{ left: state.x, top: state.y }}>
      <div className="context-menu-heading"><span>{title}</span><MoreHorizontal size={15} /></div>
      <button role="menuitem" onClick={() => { onClose(); onOpenThread(thread); }}><MessageSquarePlus size={15} /><span>Open chat</span></button>
      <button role="menuitem" onClick={() => onRename({ kind: "thread", id: thread.id, currentName: title })}><Edit3 size={15} /><span>Rename chat</span></button>
      <div className="context-menu-separator" />
      <button role="menuitem" onClick={() => onArchiveThread(thread)}><Archive size={15} /><span>Archive chat</span></button>
    </div>
  </div>;
}

function RenameDialog({ target, value, setValue, onClose, onSave }: { target: RenameTarget; value: string; setValue: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <div className="dialog-layer rename-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="rename-dialog" role="dialog" aria-modal="true" aria-label={`Rename ${target.kind}`} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="rename-header"><div><span className="eyebrow">Edit name</span><h2>Rename {target.kind}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close rename dialog"><X size={17} /></button></div>
      <label><span>Name</span><input value={value} onChange={(event) => setValue(event.target.value)} autoFocus aria-label={`${target.kind} name`} /></label>
      <div className="rename-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary" disabled={!value.trim()}>Save</button></div>
    </form>
  </div>;
}

export function SearchDialog({ query, setQuery, threads, installedItems, inputRef, onClose, onOpenThread, onNavigate, getThreadTitle = titleForThread }: { query: string; setQuery: (value: string) => void; threads: ThreadSummary[]; installedItems: CatalogItem[]; inputRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onOpenThread: (thread: ThreadSummary) => void; onNavigate: (view: View) => void; getThreadTitle?: (thread: ThreadSummary) => string }) {
  const normalized = query.trim().toLocaleLowerCase();
  const threadResults = threads.filter((thread) => !normalized || getThreadTitle(thread).toLocaleLowerCase().includes(normalized)).slice(0, 6);
  const libraryResults = installedItems.filter((item) => !normalized || [item.name, item.kind, item.description].join(" ").toLocaleLowerCase().includes(normalized)).slice(0, 3);
  return <div className="dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search Blackbox">
      <div className="search-field"><Search size={18} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats and Library…" aria-label="Search Blackbox" autoFocus /><kbd>Esc</kbd></div>
      <div className="search-results">
        {!normalized && <div className="search-shortcuts"><button onClick={() => onNavigate("library")}><Library size={16} /><span><strong>Open Library</strong><small>Manage installed customizations</small></span><ArrowRight size={15} /></button><button onClick={() => onNavigate("marketplace")}><ShoppingBag size={16} /><span><strong>Browse Marketplace</strong><small>Find themes, add-ons, and mods</small></span><ArrowRight size={15} /></button></div>}
        {threadResults.length > 0 && <SearchGroup title="Chats">{threadResults.map((thread) => <button key={thread.id} className="search-result" onClick={() => onOpenThread(thread)}><MessageSquarePlus size={15} /><span>{getThreadTitle(thread)}</span><small>{thread.cwd ? projectName(thread.cwd) : "Chat"}</small></button>)}</SearchGroup>}
        {libraryResults.length > 0 && <SearchGroup title="Library">{libraryResults.map((item) => <button key={item.id} className="search-result" onClick={() => onNavigate("library")}><Library size={15} /><span>{item.name}</span><small>{item.kind}</small></button>)}</SearchGroup>}
        {threadResults.length === 0 && libraryResults.length === 0 && <div className="no-results"><Search size={20} /><strong>No results</strong><span>Try another name or keyword.</span></div>}
      </div>
      <footer className="search-footer"><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></footer>
    </section>
  </div>;
}

function SearchGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="search-group"><h3>{title}</h3><div>{children}</div></section>;
}

function LibraryView({ items, enabledIds, onToggle, onCustomize, onRemove, onBrowse }: { items: CatalogItem[]; enabledIds: string[]; onToggle: (item: CatalogItem) => void; onCustomize: (item: CatalogItem) => void; onRemove: (item: CatalogItem) => void; onBrowse: () => void }) {
  return <section className="collection-view">
    <div className="page-heading"><div><span className="eyebrow">Yours to shape</span><h1>Library</h1><p>Every installed theme, add-on, and mod lives here. Edit with chat, activate, or remove it in one place.</p></div><button className="button button--primary" onClick={onBrowse}>Browse Marketplace<ArrowRight size={14} /></button></div>
    <div className="collection-toolbar"><span>{items.length} installed</span><div className="kind-legend"><i /> Themes <i /> Add-ons <i /> Mods</div></div>
    {items.length ? <div className="card-grid">{items.map((item) => { const enabled = enabledIds.includes(item.id); return <CatalogCard key={item.id} item={item}><button className="card-action" onClick={() => onCustomize(item)}><Sparkles size={14} />Customize</button><button className={`enable-toggle ${enabled ? "enable-toggle--on" : ""}`} onClick={() => onToggle(item)} aria-label={`${enabled ? "Disable" : "Enable"} ${item.name}`} aria-pressed={enabled}><span className="toggle-track"><i /></span>{enabled ? "Enabled" : "Disabled"}</button><button className="icon-button danger-button" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button></CatalogCard>; })}</div> : <div className="empty-collection"><Library size={24} /><h2>Your Library is empty</h2><p>Install something from the Marketplace or create it in chat.</p><button className="button button--primary" onClick={onBrowse}>Browse Marketplace</button></div>}
  </section>;
}

function MarketplaceView({ installedIds, onInstall, onOpenLibrary, onPublish }: { installedIds: string[]; onInstall: (item: CatalogItem) => void; onOpenLibrary: () => void; onPublish: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | CatalogItem["kind"]>("All");
  const items = searchCatalog(query).filter((item) => filter === "All" || item.kind === filter);
  return <section className="collection-view marketplace-view">
    <div className="page-heading"><div><span className="eyebrow">Made by the community</span><h1>Marketplace</h1><p>Discover thoughtful ways to make Blackbox yours. Installations always land in your Library.</p></div><button className="button button--secondary" onClick={onPublish}><Upload size={14} />Share yours</button></div>
    <div className="market-controls"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Marketplace" aria-label="Search Marketplace" /></label><div className="filter-tabs">{(["All", "Theme", "Add-on", "Mod"] as const).map((kind) => <button key={kind} className={filter === kind ? "active" : ""} onClick={() => setFilter(kind)}>{kind}</button>)}</div></div>
    <div className="featured-row"><span><Sparkles size={15} />Featured this week</span><button onClick={onOpenLibrary}>View Library <ArrowRight size={14} /></button></div>
    {items.length ? <div className="card-grid">{items.map((item) => { const installed = installedIds.includes(item.id); return <CatalogCard key={item.id} item={item}><button className={`card-action install-action ${installed ? "card-action--active" : ""}`} disabled={installed} onClick={() => onInstall(item)}>{installed ? <Check size={14} /> : <Download size={14} />}{installed ? "In Library" : "Install"}</button></CatalogCard>; })}</div> : <div className="empty-collection"><Search size={24} /><h2>No matches</h2><p>Try a broader keyword or another category.</p></div>}
  </section>;
}

function CatalogCard({ item, children }: { item: CatalogItem; children: ReactNode }) {
  return <article className="catalog-card"><div className="catalog-preview" style={{ "--card-accent": item.accent } as React.CSSProperties}><span className="preview-orb" /><span className="preview-line preview-line--wide" /><span className="preview-line" /></div><div className="catalog-card-body"><div className="catalog-meta"><span>{item.kind}</span><small>v{item.version}</small></div><h2>{item.name}</h2><p>{item.description}</p><div className="catalog-footer"><span>by {item.author}</span><div className="catalog-actions">{children}</div></div></div></article>;
}
