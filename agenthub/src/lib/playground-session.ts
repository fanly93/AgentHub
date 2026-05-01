import { PlaygroundSessionSchema, type PlaygroundSession, type PlaygroundResponse, type ModelId } from "@/shared/schemas/playgroundResponse";
import { AgentSessionRecordSchema, type AgentSessionRecord } from "@/shared/schemas/agentStream";

const SESSION_KEY = "playground:last-response";

export function saveSession(response: PlaygroundResponse, model: ModelId, prompt: string): void {
  if (typeof window === "undefined") return;
  try {
    const session: PlaygroundSession = { response, model, prompt, savedAt: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage 满或被禁用时静默忽略
  }
}

export function restoreSession(): PlaygroundSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const result = PlaygroundSessionSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}


const AGENT_SESSION_KEY = "agent:last-execution";

export function saveAgentSession(record: AgentSessionRecord): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(record));
  } catch {
    // sessionStorage 满或被禁用时静默忽略
  }
}

export function restoreAgentSession(): AgentSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AGENT_SESSION_KEY);
    if (!raw) return null;
    const result = AgentSessionRecordSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}
