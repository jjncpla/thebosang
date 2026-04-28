// Claude Code hooks가 보낸 이벤트를 메모리에 저장하는 단순 스토어.
// Next.js dev / Railway 단일 인스턴스 기준.
// 멀티 인스턴스 배포 확장 시 Redis(Upstash)로 교체.

export type CharacterId =
  | 'orchestrator'
  | 'dev'
  | 'design'
  | 'security'
  | 'planning';

export type AgentState = 'idle' | 'thinking' | 'working' | 'done';

export interface AgentActivity {
  characterId: CharacterId;
  state: AgentState;
  activity: string;
  updatedAt: number;
}

export interface ActivityLogEntry {
  id: number;
  characterId: CharacterId;
  message: string;
  state: AgentState;
  timestamp: number;
}

// ─── 서브에이전트 → 캐릭터 매핑 ─────────────────────────
// agents/ 디렉토리에 등록된 서브에이전트 이름과 일치
const SUBAGENT_TO_CHARACTER: Record<string, CharacterId> = {
  orchestrator: 'orchestrator',
  dev: 'dev',
  design: 'design',
  security: 'security',
  planning: 'planning',
};

// 메인 세션(서브에이전트 X)일 때 도구로 캐릭터 추정
function characterFromTool(
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
): CharacterId {
  const filePath = (toolInput?.file_path as string) || '';

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
    if (/(prisma|schema|migration|\.sql|docs\/.*\.md)/i.test(filePath)) return 'planning';
    if (/(test|spec|__tests__|auth|security|password|encryption)/i.test(filePath)) return 'security';
    if (/(\/app\/|\/components\/|\.tsx|\.css)/.test(filePath)) return 'design';
    if (/(\/api\/|\/lib\/|server|route\.ts)/.test(filePath)) return 'dev';
    return 'dev';
  }
  if (toolName === 'Bash') return 'dev';
  if (['Read', 'Grep', 'Glob'].includes(toolName)) return 'orchestrator';
  return 'dev';
}

// 이벤트 → 표시용 활동 문자열
function buildActivityMessage(
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
): string {
  if (!toolName) return '작업 중';
  const filePath = (toolInput?.file_path as string) || '';
  const command = (toolInput?.command as string) || '';
  const pattern = (toolInput?.pattern as string) || '';

  if (filePath) {
    const short = filePath.split(/[\\/]/).slice(-2).join('/');
    return `${toolName} · ${short}`;
  }
  if (command) {
    const short = command.length > 40 ? command.slice(0, 38) + '…' : command;
    return `$ ${short}`;
  }
  if (pattern) return `검색: ${pattern}`;
  return toolName;
}

// ─── 스토어 본체 ────────────────────────────────────────
type Store = {
  states: Map<CharacterId, AgentActivity>;
  log: ActivityLogEntry[];
  logCounter: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __agentStore: Store | undefined;
}

const store: Store =
  global.__agentStore ??
  (global.__agentStore = {
    states: new Map(),
    log: [],
    logCounter: 0,
  });

// ─── 공개 API ───────────────────────────────────────────
export interface HookPayload {
  hook_event_name?: string;
  hook_event?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  agent_id?: string;
  agent_type?: string;
  session_id?: string;
}

export function recordHookEvent(
  eventName: string,
  payload: HookPayload,
): void {
  const characterId =
    (payload.agent_type && SUBAGENT_TO_CHARACTER[payload.agent_type]) ||
    characterFromTool(payload.tool_name || '', payload.tool_input);

  let nextState: AgentState = 'idle';
  if (eventName === 'PreToolUse') nextState = 'working';
  else if (eventName === 'PostToolUse') nextState = 'done';
  else if (eventName === 'SubagentStop' || eventName === 'Stop') nextState = 'done';

  const message = buildActivityMessage(payload.tool_name || '', payload.tool_input);

  store.states.set(characterId, {
    characterId,
    state: nextState,
    activity: message,
    updatedAt: Date.now(),
  });

  // 로그에는 PreToolUse(시작)와 SubagentStop/Stop(완료)만 기록
  if (eventName === 'PreToolUse' || eventName === 'SubagentStop' || eventName === 'Stop') {
    store.logCounter += 1;
    store.log.unshift({
      id: store.logCounter,
      characterId,
      message: eventName === 'PreToolUse' ? message : `${message} 완료`,
      state: nextState,
      timestamp: Date.now(),
    });
    store.log = store.log.slice(0, 20);
  }
}

const IDLE_TIMEOUT_MS = 30000;

export function getSnapshot() {
  const now = Date.now();
  const states: AgentActivity[] = [];

  for (const [, activity] of store.states) {
    if (now - activity.updatedAt > IDLE_TIMEOUT_MS && activity.state !== 'idle') {
      states.push({ ...activity, state: 'idle' });
    } else {
      states.push(activity);
    }
  }

  return {
    states,
    log: store.log.slice(0, 8),
    serverTime: now,
  };
}

export function clearStore() {
  store.states.clear();
  store.log = [];
  store.logCounter = 0;
}
