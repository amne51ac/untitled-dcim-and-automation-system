/** Client-side chat history for the AI assistant (localStorage). */

export type AssistantMsg = { role: "user" | "assistant"; content: string };

export type AssistantThread = {
  id: string;
  title: string;
  /** epoch ms, for sorting and display */
  updatedAt: number;
  messages: AssistantMsg[];
};

const STORAGE_KEY = "intentcenter.aiAssistant.conversations";
const V = 1;

const MAX_THREADS = 50;
const MAX_MSGS = 100;

type PersistedV1 = { v: 1; threads: AssistantThread[]; activeId: string };

function newId(): string {
  return crypto.randomUUID();
}

function emptyThread(): AssistantThread {
  return {
    id: newId(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
  };
}

export function titleFromFirstUserMessage(text: string): string {
  const s = text.trim().replace(/\s+/g, " ");
  if (!s) return "New chat";
  return s.length > 48 ? s.slice(0, 45) + "…" : s;
}

function trimMessages(msgs: AssistantMsg[]): AssistantMsg[] {
  if (msgs.length <= MAX_MSGS) return msgs;
  return msgs.slice(-MAX_MSGS);
}

function trimThreads(threads: AssistantThread[]): AssistantThread[] {
  if (threads.length <= MAX_THREADS) return threads;
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, MAX_THREADS);
}

export function loadAssistantChats(): { threads: AssistantThread[]; activeId: string } {
  if (typeof window === "undefined") {
    const t = emptyThread();
    return { threads: [t], activeId: t.id };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const t = emptyThread();
      return { threads: [t], activeId: t.id };
    }
    const p = JSON.parse(raw) as PersistedV1 | { threads?: AssistantThread[]; activeId?: string };
    if (p && Array.isArray((p as PersistedV1).threads) && (p as PersistedV1).threads.length > 0) {
      const tlist = (p as PersistedV1).threads.map((th) => ({
        ...th,
        messages: trimMessages(Array.isArray(th.messages) ? th.messages : []),
      }));
      const aid = (p as PersistedV1).activeId && tlist.some((x) => x.id === (p as PersistedV1).activeId)
        ? (p as PersistedV1).activeId
        : tlist[0].id;
      return { threads: trimThreads(tlist), activeId: aid! };
    }
  } catch {
    /* fallthrough */
  }
  const t = emptyThread();
  return { threads: [t], activeId: t.id };
}

export function saveAssistantChats(threads: AssistantThread[], activeId: string): void {
  try {
    const body: PersistedV1 = {
      v: V,
      threads: trimThreads(threads).map((th) => ({ ...th, messages: trimMessages(th.messages) })),
      activeId,
    };
    if (!body.threads.some((x) => x.id === body.activeId) && body.threads[0]) {
      body.activeId = body.threads[0].id;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* storage full or disabled */
  }
}

export { emptyThread };
