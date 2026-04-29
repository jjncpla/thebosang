'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── 타입 ──────────────────────────────────────────────
type CharacterId = 'orchestrator' | 'dev' | 'design' | 'security' | 'planning';
type AgentState = 'idle' | 'thinking' | 'working' | 'done';
type AccessoryKind = 'glasses' | 'hood' | 'bun' | 'ponytail' | 'cap';

interface CharacterDef {
  id: CharacterId;
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  accessory: AccessoryKind;
}

interface AgentSnapshot {
  state: AgentState;
  activity: string;
}

interface ApiState {
  characterId: CharacterId;
  state: AgentState;
  activity: string;
}

interface ApiLogEntry {
  id: number;
  characterId: CharacterId;
  message: string;
  state: AgentState;
  timestamp: number;
}

interface ApiSnapshot {
  states?: ApiState[];
  log?: ApiLogEntry[];
}

interface UiLogEntry {
  id: number;
  time: string;
  name: string;
  color: string;
  msg: string;
  done: boolean;
}

// ─── 캐릭터 정의 (정준님 에이전트 5종) ───────────────────
const CHARACTERS: Record<CharacterId, CharacterDef> = {
  orchestrator: {
    id: 'orchestrator',
    name: '총괄',
    skin: '#f4cfa3',
    hair: '#475569',
    shirt: '#475569',
    shirtDark: '#334155',
    accessory: 'glasses',
  },
  dev: {
    id: 'dev',
    name: '개발',
    skin: '#f0c89a',
    hair: '#1f2937',
    shirt: '#3b82f6',
    shirtDark: '#2563eb',
    accessory: 'hood',
  },
  design: {
    id: 'design',
    name: '디자인',
    skin: '#f4cfa3',
    hair: '#92400e',
    shirt: '#f59e0b',
    shirtDark: '#d97706',
    accessory: 'ponytail',
  },
  security: {
    id: 'security',
    name: '보안',
    skin: '#f0c89a',
    hair: '#7c2d12',
    shirt: '#ef4444',
    shirtDark: '#dc2626',
    accessory: 'cap',
  },
  planning: {
    id: 'planning',
    name: '기획',
    skin: '#e8b888',
    hair: '#581c87',
    shirt: '#a855f7',
    shirtDark: '#9333ea',
    accessory: 'bun',
  },
};

const ORDER: CharacterId[] = ['orchestrator', 'dev', 'design', 'security', 'planning'];

const POLL_INTERVAL_MS = 1500;
const API_ENDPOINT = '/api/agent-activity';

// ─── 데모 모드용 가짜 활동 (TBSS 프로젝트 맥락) ──────────
const DEMO_ACTIVITIES: Record<CharacterId, string[]> = {
  orchestrator: ['Task 분해', 'agents/dev.md 위임', '결과 통합 보고'],
  dev: ['Edit · api/cases/route.ts', '$ npx prisma db push', 'Edit · lib/pdf.ts'],
  design: ['Edit · app/login/page.tsx', 'components/AgentOffice.tsx', 'Tailwind 조정'],
  security: ['Read · auth.ts', '권한 매트릭스 점검', 'AGENT_OFFICE_TOKEN 검토'],
  planning: ['Edit · docs/통합기획서.md', 'Phase 4-3 체크리스트', 'PRD 검토'],
};

// ─── 캐릭터 SVG ──────────────────────────────────────────
interface CharacterProps {
  character: CharacterDef;
  state: AgentState;
}

function Character({ character, state }: CharacterProps) {
  const isWorking = state === 'working';
  const bobClass = isWorking ? 'animate-bob-fast' : 'animate-bob-slow';

  return (
    <svg viewBox="0 0 60 70" className={`w-14 h-16 ${bobClass}`}>
      <path d="M 12 70 L 14 42 Q 30 38 46 42 L 48 70 Z" fill={character.shirt} />
      <path
        d="M 14 42 Q 30 38 46 42 L 45 48 Q 30 44 15 48 Z"
        fill={character.shirtDark}
        opacity="0.4"
      />
      <rect x="26" y="32" width="8" height="6" fill={character.skin} />
      <ellipse cx="30" cy="22" rx="12" ry="13" fill={character.skin} />

      {character.accessory === 'glasses' && (
        <>
          <path
            d="M 18 16 Q 20 8 30 9 Q 40 8 42 16 L 42 22 Q 38 14 30 14 Q 22 14 18 22 Z"
            fill={character.hair}
          />
          <circle cx="25" cy="22" r="3" fill="none" stroke="#1f2937" strokeWidth="0.8" />
          <circle cx="35" cy="22" r="3" fill="none" stroke="#1f2937" strokeWidth="0.8" />
          <line x1="28" y1="22" x2="32" y2="22" stroke="#1f2937" strokeWidth="0.8" />
        </>
      )}
      {character.accessory === 'hood' && (
        <>
          <path
            d="M 14 26 Q 14 6 30 6 Q 46 6 46 26 L 44 30 Q 30 22 16 30 Z"
            fill={character.shirtDark}
          />
          <ellipse cx="30" cy="24" rx="11" ry="9" fill={character.skin} />
        </>
      )}
      {character.accessory === 'bun' && (
        <>
          <circle cx="30" cy="8" r="5" fill={character.hair} />
          <path
            d="M 18 18 Q 18 12 30 12 Q 42 12 42 18 L 42 24 Q 38 18 30 18 Q 22 18 18 24 Z"
            fill={character.hair}
          />
        </>
      )}
      {character.accessory === 'ponytail' && (
        <>
          <path
            d="M 18 18 Q 18 8 30 8 Q 42 8 42 18 L 42 24 Q 38 18 30 18 Q 22 18 18 24 Z"
            fill={character.hair}
          />
          <path d="M 42 16 Q 50 22 48 32 Q 44 28 42 22 Z" fill={character.hair} />
        </>
      )}
      {character.accessory === 'cap' && (
        <>
          <path
            d="M 16 18 Q 16 10 30 10 Q 44 10 44 18 L 46 22 L 14 22 Z"
            fill={character.shirtDark}
          />
          <ellipse cx="30" cy="20" rx="16" ry="3" fill={character.shirtDark} />
        </>
      )}

      {state === 'thinking' ? (
        <>
          <path d="M 24 23 L 27 23" stroke="#1f2937" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 33 23 L 36 23" stroke="#1f2937" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25.5" cy="23" r="1.2" fill="#1f2937" />
          <circle cx="34.5" cy="23" r="1.2" fill="#1f2937" />
        </>
      )}

      {state === 'done' ? (
        <path
          d="M 27 28 Q 30 31 33 28"
          stroke="#1f2937"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path d="M 28 28 L 32 28" stroke="#1f2937" strokeWidth="0.8" strokeLinecap="round" />
      )}

      {isWorking && (
        <>
          <circle cx="18" cy="58" r="2.5" fill={character.skin} className="animate-type-l" />
          <circle cx="42" cy="58" r="2.5" fill={character.skin} className="animate-type-r" />
        </>
      )}
    </svg>
  );
}

// ─── 책상 ────────────────────────────────────────────────
interface DeskProps {
  character: CharacterDef;
  state: AgentState;
  activity: string;
}

function Desk({ character, state, activity }: DeskProps) {
  const screenColor =
    state === 'working' ? '#0ea5e9' :
    state === 'done' ? '#10b981' :
    state === 'thinking' ? '#a78bfa' :
    '#475569';

  return (
    <div className="relative flex flex-col items-center" style={{ width: '110px' }}>
      <div
        className={`absolute -top-2 left-1/2 -translate-x-1/2 transition-all duration-500 ${
          state === 'idle' ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
        }`}
        style={{ minWidth: '140px', maxWidth: '180px', zIndex: 20 }}
      >
        <div className="bg-white rounded-xl px-3 py-1.5 shadow-md border border-stone-200 relative">
          <div className="text-[10px] text-stone-700 leading-tight text-center font-medium truncate">
            {state === 'thinking' && (
              <span className="inline-flex gap-0.5">
                <span className="animate-blink-1">●</span>
                <span className="animate-blink-2">●</span>
                <span className="animate-blink-3">●</span>
              </span>
            )}
            {state === 'working' && activity}
            {state === 'done' && <span className="text-emerald-600">✓ {activity}</span>}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-stone-200 rotate-45" />
        </div>
      </div>

      <div className="relative" style={{ marginBottom: '-18px', zIndex: 5 }}>
        <Character character={character} state={state} />
      </div>

      <div className="relative w-full" style={{ zIndex: 10 }}>
        <div className="mx-auto" style={{ width: '70px' }}>
          <div className="bg-stone-800 rounded-md p-1 shadow-sm">
            <div
              className="rounded-sm transition-colors duration-300"
              style={{ height: '32px', backgroundColor: screenColor }}
            >
              {state === 'working' && (
                <div className="p-1 space-y-0.5">
                  <div className="h-0.5 bg-white/60 rounded animate-code-1" />
                  <div className="h-0.5 bg-white/40 rounded animate-code-2" />
                  <div className="h-0.5 bg-white/50 rounded animate-code-3" />
                </div>
              )}
            </div>
            <div className="h-1 w-3 bg-stone-700 mx-auto mt-0.5 rounded-b" />
          </div>
        </div>
        <div className="h-2 bg-amber-700 rounded-sm shadow-sm" />
        <div className="h-1 bg-amber-900/40" />
      </div>

      <div className="mt-1 text-[10px] font-bold text-stone-700 tracking-wide">
        {character.name}
      </div>
      <div
        className="w-1.5 h-1.5 rounded-full mt-0.5"
        style={{
          backgroundColor:
            state === 'working' ? '#0ea5e9' :
            state === 'done' ? '#10b981' :
            state === 'thinking' ? '#a78bfa' :
            '#94a3b8',
          boxShadow: state !== 'idle' ? `0 0 6px ${
            state === 'working' ? '#0ea5e9' :
            state === 'done' ? '#10b981' :
            '#a78bfa'
          }` : 'none',
        }}
      />
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────
interface AgentOfficeProps {
  demoMode?: 'auto' | 'live' | 'demo';
}

export default function AgentOffice({ demoMode = 'auto' }: AgentOfficeProps) {
  const [agentStates, setAgentStates] = useState<Record<CharacterId, AgentSnapshot>>(
    () => Object.fromEntries(
      ORDER.map((id) => [id, { state: 'idle', activity: '' }])
    ) as Record<CharacterId, AgentSnapshot>,
  );
  const [log, setLog] = useState<UiLogEntry[]>([]);
  const [time, setTime] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(demoMode === 'live');
  const failureCountRef = useRef<number>(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIdRef = useRef<number>(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data: ApiSnapshot = await res.json();

      const next = Object.fromEntries(
        ORDER.map((id) => [id, { state: 'idle' as AgentState, activity: '' }]),
      ) as Record<CharacterId, AgentSnapshot>;

      for (const s of data.states || []) {
        if (next[s.characterId]) {
          next[s.characterId] = { state: s.state, activity: s.activity };
        }
      }
      setAgentStates(next);
      setLog(
        (data.log || []).map((entry) => ({
          id: entry.id,
          time: new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour12: false }),
          name: CHARACTERS[entry.characterId]?.name || '?',
          color: CHARACTERS[entry.characterId]?.shirt || '#888',
          msg: entry.message,
          done: entry.state === 'done',
        })),
      );
      failureCountRef.current = 0;
      setIsLive(true);
    } catch {
      failureCountRef.current += 1;
      if (demoMode === 'auto' && failureCountRef.current >= 3) {
        setIsLive(false);
      }
    }
  }, [demoMode]);

  useEffect(() => {
    if (demoMode === 'demo') {
      setIsLive(false);
      return;
    }
    // 운영 환경(localhost/127.0.0.1 외) — Railway 같은 배포처는 hook이 도달하지 않으므로 DEMO 강제
    if (
      demoMode === 'auto' &&
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setIsLive(false);
      return;
    }
    fetchActivity();
    const i = setInterval(fetchActivity, POLL_INTERVAL_MS);
    return () => clearInterval(i);
  }, [demoMode, fetchActivity]);

  useEffect(() => {
    if (isLive) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      return;
    }

    demoIntervalRef.current = setInterval(() => {
      setAgentStates((prev) => {
        const next = { ...prev };
        const id = ORDER[Math.floor(Math.random() * ORDER.length)];
        const cur = next[id].state;
        let nextState: AgentState;
        if (cur === 'idle') nextState = 'thinking';
        else if (cur === 'thinking') nextState = 'working';
        else if (cur === 'working') nextState = 'done';
        else nextState = 'idle';

        const acts = DEMO_ACTIVITIES[id];
        const activity =
          nextState === 'working' || nextState === 'thinking'
            ? acts[Math.floor(Math.random() * acts.length)]
            : next[id].activity;

        next[id] = { state: nextState, activity };

        if (nextState === 'working' || nextState === 'done') {
          const ts = new Date();
          logIdRef.current += 1;
          setLog((l) =>
            [
              {
                id: logIdRef.current,
                time: ts.toLocaleTimeString('ko-KR', { hour12: false }),
                name: CHARACTERS[id].name,
                color: CHARACTERS[id].shirt,
                msg: nextState === 'working' ? activity : `${activity} 완료`,
                done: nextState === 'done',
              },
              ...l,
            ].slice(0, 5),
          );
        }
        return next;
      });
    }, 1400);

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [isLive]);

  const activeCount = Object.values(agentStates).filter((s) => s.state !== 'idle').length;
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');

  return (
    <div className="w-full mx-auto p-6 bg-stone-100 rounded-2xl">
      <style>{`
        @keyframes bob-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        @keyframes bob-fast { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes type-l { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes type-r { 0%,100% { transform: translateY(-3px); } 50% { transform: translateY(0); } }
        @keyframes blink-1 { 0%,60%,100% { opacity: 0.3; } 30% { opacity: 1; } }
        @keyframes blink-2 { 0%,60%,100% { opacity: 0.3; } 40% { opacity: 1; } }
        @keyframes blink-3 { 0%,60%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes code-1 { 0%,100% { width: 60%; } 50% { width: 90%; } }
        @keyframes code-2 { 0%,100% { width: 80%; } 50% { width: 50%; } }
        @keyframes code-3 { 0%,100% { width: 40%; } 50% { width: 75%; } }
        @keyframes log-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .animate-bob-slow { animation: bob-slow 3s ease-in-out infinite; transform-origin: center bottom; }
        .animate-bob-fast { animation: bob-fast 0.6s ease-in-out infinite; transform-origin: center bottom; }
        .animate-type-l { animation: type-l 0.3s ease-in-out infinite; }
        .animate-type-r { animation: type-r 0.3s ease-in-out infinite; }
        .animate-blink-1 { animation: blink-1 1.2s infinite; }
        .animate-blink-2 { animation: blink-2 1.2s infinite; }
        .animate-blink-3 { animation: blink-3 1.2s infinite; }
        .animate-code-1 { animation: code-1 1s ease-in-out infinite; }
        .animate-code-2 { animation: code-2 1.3s ease-in-out infinite; }
        .animate-code-3 { animation: code-3 0.9s ease-in-out infinite; }
        .animate-log-in { animation: log-in 0.4s ease-out; }
      `}</style>

      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${
              isLive ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-xs font-semibold text-stone-700 tracking-wide">
            CLAUDE CODE 사무실
          </span>
          <span className="text-[10px] text-stone-500">
            · {isLive ? 'LIVE' : 'DEMO'} · 작업 중 {activeCount}/{ORDER.length}
          </span>
        </div>
        <div className="text-xs font-mono text-stone-600">
          {hh}:{mm}
        </div>
      </div>

      <div
        className="relative rounded-xl overflow-hidden shadow-inner"
        style={{
          background:
            'linear-gradient(180deg, #fef3e2 0%, #f5e6cf 70%, #d4a574 70%, #b8895d 100%)',
          height: '230px',
        }}
      >
        <div className="absolute top-4 left-8 w-20 h-14 rounded-md border-4 border-amber-900/30 bg-gradient-to-b from-sky-200 to-sky-100 shadow-inner">
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-r-2 border-amber-900/30" />
            <div className="flex-1" />
          </div>
        </div>
        <div className="absolute top-4 right-8 w-20 h-14 rounded-md border-4 border-amber-900/30 bg-gradient-to-b from-sky-200 to-sky-100 shadow-inner">
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-r-2 border-amber-900/30" />
            <div className="flex-1" />
          </div>
        </div>

        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border-4 border-stone-700 flex items-center justify-center text-[8px] font-mono text-stone-700 shadow-sm">
          {hh}:{mm}
        </div>

        <div className="absolute bottom-12 left-2">
          <div className="w-4 h-3 bg-amber-800 rounded-b mx-auto" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-base">🌿</div>
        </div>

        <div className="absolute bottom-3 left-0 right-0 flex justify-around items-end px-4">
          {ORDER.map((id) => (
            <Desk
              key={id}
              character={CHARACTERS[id]}
              state={agentStates[id].state}
              activity={agentStates[id].activity}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 bg-stone-900 rounded-xl px-4 py-3 font-mono text-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-stone-700">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-stone-300 text-[10px] tracking-widest font-sans font-semibold">
            ACTIVITY LOG
          </span>
        </div>
        <div className="space-y-1 min-h-[100px]">
          {log.length === 0 && (
            <div className="text-stone-500 text-[11px] italic">대기 중...</div>
          )}
          {log.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 animate-log-in">
              <span className="text-stone-500 text-[11px]">{entry.time}</span>
              <span className="text-[11px] font-bold" style={{ color: entry.color }}>
                {entry.name}
              </span>
              <span
                className={`text-[11px] flex-1 ${
                  entry.done ? 'text-emerald-400' : 'text-stone-300'
                }`}
              >
                {entry.done ? '✓ ' : '› '}
                {entry.msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
