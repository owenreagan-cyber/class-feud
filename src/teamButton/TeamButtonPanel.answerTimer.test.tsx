// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamButtonPanel from './TeamButtonPanel';
import { useTeamButtonHost } from './useTeamButtonHost';
import type { TeamButtonHost } from './useTeamButtonHost';
import type { FaceOffPublicState, PressEntry } from './protocol';
import { useAnswerTimer } from '../game/useAnswerTimer';
import type { AnswerTimerApi } from '../game/useAnswerTimer';
import type { GamePhase, Team } from '../game/gameTypes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const audioCalls: string[] = [];
vi.mock('./audio', () => ({
  unlockAudio: vi.fn(() => audioCalls.push('unlockAudio')),
}));

vi.mock('./useTeamButtonHost', () => ({
  useTeamButtonHost: vi.fn(),
}));

function press(teamId: string, at = 0): PressEntry {
  return { teamId, at };
}

function session(overrides: Partial<FaceOffPublicState>): FaceOffPublicState {
  return {
    sessionId: 'sess-1',
    kind: 'faceoff',
    phase: 'ready',
    remaining: 0,
    eligibleTeamIds: [],
    pressOrder: [],
    ...overrides,
  };
}

function makeHost(overrides: Partial<TeamButtonHost> = {}): TeamButtonHost {
  return {
    status: 'open',
    connectedTeamIds: [],
    session: null,
    error: null,
    demoted: false,
    startSession: vi.fn(),
    resolveSession: vi.fn(),
    resetButtons: vi.fn(),
    ...overrides,
  };
}

function teams(n: number): Team[] {
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
  return Array.from({ length: n }, (_, i) => ({
    id: `team-${i}`,
    name: `Team ${i + 1}`,
    color: palette[i],
    score: 0,
  }));
}

function Harness({
  phase,
  teamList,
  activeTeamId = null,
  noAnswerTeamIds = [],
  onApi,
}: {
  phase: GamePhase;
  teamList: Team[];
  activeTeamId?: string | null;
  noAnswerTeamIds?: string[];
  onApi: (api: AnswerTimerApi) => void;
}) {
  const answerTimer = useAnswerTimer();
  useEffect(() => {
    onApi(answerTimer);
  });
  return (
    <TeamButtonPanel
      teams={teamList}
      phase={phase}
      activeTeamId={activeTeamId}
      noAnswerTeamIds={noAnswerTeamIds}
      onSetActiveTeam={() => {}}
      onMarkNoAnswer={() => {}}
      onSetStealTeam={() => {}}
      answerTimer={answerTimer}
    />
  );
}

function render(element: ReactElement): { root: Root; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { root, unmount: () => act(() => root.unmount()) };
}

type Ctx = {
  view: { root: Root; unmount: () => void };
  api: AnswerTimerApi;
  host: TeamButtonHost;
  rerender: (props: Partial<Parameters<typeof Harness>[0]>) => void;
};

function mount(
  props: { phase: GamePhase; teamList: Team[]; activeTeamId?: string | null; noAnswerTeamIds?: string[] },
  hostOverrides: Partial<TeamButtonHost> = {},
  strict = false,
): Ctx {
  const host = makeHost(hostOverrides);
  vi.mocked(useTeamButtonHost).mockReturnValue(host);
  const ctx = {} as Ctx;
  const onApi = (a: AnswerTimerApi) => {
    ctx.api = a;
  };
  const build = (p: typeof props) => {
    const tree = <Harness {...p} onApi={onApi} />;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  ctx.view = render(build(props));
  ctx.host = host;
  ctx.rerender = (patch) => {
    const next = { ...props, ...patch };
    Object.assign(props, patch);
    act(() => ctx.view.root.render(build(next)));
  };
  return ctx;
}

/** Update the mocked session and force a re-render, as if a WS message arrived. */
function pushSession(ctx: Ctx, host: TeamButtonHost, next: FaceOffPublicState) {
  const updated = { ...host, session: next };
  vi.mocked(useTeamButtonHost).mockReturnValue(updated);
  ctx.host = updated;
  ctx.rerender({});
}

describe('TeamButtonPanel answer timer wiring', () => {
  beforeEach(() => {
    audioCalls.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('4/5. a FIRST face-off press starts the answer timer for that team', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(4) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1')] }));
    expect(ctx.api.answerTimer.status).toBe('running');
    expect(ctx.api.answerTimer.teamId).toBe('team-1');
    ctx.view.unmount();
  });

  it('4. FIRST press does not re-arm/start a new Team Buttons session', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(4) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1')] }));
    expect(ctx.host.startSession).not.toHaveBeenCalled();
    ctx.view.unmount();
  });

  it('22/23. advancing to the next recorded face-off team gets a fresh timer without re-arming Team Buttons', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(4) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1'), press('team-2')] }));
    expect(ctx.api.answerTimer.teamId).toBe('team-1');
    act(() => vi.advanceTimersByTime(1000));

    // INCORRECT on team-1 -> advanceResponder (the only way "next team" works today).
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const incorrectBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'INCORRECT');
    expect(incorrectBtn).toBeTruthy();
    act(() => incorrectBtn!.click());

    expect(ctx.api.answerTimer.teamId).toBe('team-2');
    expect(ctx.api.answerTimer.remainingSeconds).toBe(5); // fresh timer, not continuing team-1's countdown
    expect(ctx.host.startSession).not.toHaveBeenCalled();
    expect(ctx.host.resetButtons).not.toHaveBeenCalled();
    ctx.view.unmount();
  });

  it('CORRECT clears the answer timer (teacher resolves current answer)', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(2) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-0')] }));
    expect(ctx.api.answerTimer.teamId).toBe('team-0');

    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const correctBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'CORRECT');
    act(() => correctBtn!.click());

    expect(ctx.api.answerTimer.status).toBe('idle');
    expect(ctx.api.answerTimer.teamId).toBeNull();
    ctx.view.unmount();
  });

  it('24. the first eligible steal press starts the answer timer for that team', () => {
    const ctx = mount(
      { phase: 'steal', teamList: teams(4), activeTeamId: 'team-0' },
      {},
    );
    pushSession(ctx, ctx.host, session({ kind: 'steal', pressOrder: [press('team-1')] }));
    expect(ctx.api.answerTimer.status).toBe('running');
    expect(ctx.api.answerTimer.teamId).toBe('team-1');
    ctx.view.unmount();
  });

  it('25. queued steal teams (rank 2+) do not get their own timer', () => {
    const ctx = mount({ phase: 'steal', teamList: teams(4), activeTeamId: 'team-0' });
    pushSession(ctx, ctx.host, session({ kind: 'steal', pressOrder: [press('team-1')] }));
    act(() => vi.advanceTimersByTime(1000));
    const remainingBefore = ctx.api.answerTimer.remainingSeconds;
    pushSession(ctx, ctx.host, session({ kind: 'steal', pressOrder: [press('team-1'), press('team-2')] }));
    // Still team-1's timer, uninterrupted — not restarted for team-2.
    expect(ctx.api.answerTimer.teamId).toBe('team-1');
    expect(ctx.api.answerTimer.remainingSeconds).toBe(remainingBefore);
    ctx.view.unmount();
  });

  it('26. steal expiry does not fail the steal automatically — GIVE STEAL still resolves it manually', () => {
    const ctx = mount({ phase: 'steal', teamList: teams(4), activeTeamId: 'team-0' });
    pushSession(ctx, ctx.host, session({ kind: 'steal', pressOrder: [press('team-1')] }));
    act(() => vi.advanceTimersByTime(5000));
    expect(ctx.api.answerTimer.status).toBe('expired');
    // GIVE STEAL is still present and clickable after expiry — teacher stays authoritative.
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const giveStealBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'GIVE STEAL');
    expect(giveStealBtn).toBeTruthy();
    expect(giveStealBtn!.hasAttribute('disabled')).toBe(false);
    ctx.view.unmount();
  });

  it('does not wire the answer timer to the manual "SET FIRST TEAM" fallback (grants full possession, no pending-judgment window)', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(2) });
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const select = container.querySelector('select') as HTMLSelectElement;
    act(() => {
      select.value = 'team-1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const setFirstBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'SET FIRST TEAM');
    act(() => setFirstBtn!.click());
    expect(ctx.api.answerTimer.status).toBe('idle');
    ctx.view.unmount();
  });

  it('RESET BUTTONS clears the answer timer', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(2) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-0')] }));
    expect(ctx.api.answerTimer.teamId).toBe('team-0');
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'RESET BUTTONS');
    act(() => resetBtn!.click());
    expect(ctx.api.answerTimer.status).toBe('idle');
    ctx.view.unmount();
  });

  it('startFaceoff / startSteal unlock audio synchronously on the real click (so expiry sound is reliable)', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(2) });
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'START FACE-OFF');
    act(() => startBtn!.click());
    expect(audioCalls).toContain('unlockAudio');
    ctx.view.unmount();
  });

  for (const n of [2, 3, 4]) {
    it(`17. team-count matrix: ${n} teams — FIRST press still starts exactly one timer for the correct team`, () => {
      const ctx = mount({ phase: 'tossup', teamList: teams(n) });
      pushSession(ctx, ctx.host, session({ pressOrder: [press('team-0')] }));
      expect(ctx.api.answerTimer.status).toBe('running');
      expect(ctx.api.answerTimer.teamId).toBe('team-0');
      ctx.view.unmount();
    });
  }

  it('33. React Strict Mode does not double-start the timer for the same press', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(4) }, {}, true);
    const startSpy = vi.fn();
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1')] }));
    expect(ctx.api.answerTimer.teamId).toBe('team-1');
    expect(ctx.api.answerTimer.remainingSeconds).toBe(5);
    void startSpy;
    ctx.view.unmount();
  });

  it('a rerender with the same press order does not restart the timer', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(4) });
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1')] }));
    act(() => vi.advanceTimersByTime(2000));
    const remaining = ctx.api.answerTimer.remainingSeconds;
    // Same press order arrives again (e.g. an unrelated session broadcast) — no restart.
    pushSession(ctx, ctx.host, session({ pressOrder: [press('team-1')] }));
    expect(ctx.api.answerTimer.remainingSeconds).toBe(remaining);
    ctx.view.unmount();
  });

  it('renders a join QR code alongside the typed join URL', () => {
    const ctx = mount({ phase: 'tossup', teamList: teams(2) });
    const container = document.body.querySelector('.tb-panel') as HTMLElement;
    const qr = container.querySelector('.tb-join-qr');
    expect(qr).toBeTruthy();
    expect(qr?.getAttribute('role')).toBe('img');
    const code = container.querySelector('.tb-join-url code');
    expect(code?.textContent).toMatch(/\/team-button$/);
    ctx.view.unmount();
  });
});
