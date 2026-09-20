// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamButtonPanel from './TeamButtonPanel';
import { useTeamButtonHost } from './useTeamButtonHost';
import type { TeamButtonHost } from './useTeamButtonHost';
import { isLoopbackHost } from './joinAddress';
import { useAnswerTimer } from '../game/useAnswerTimer';
import type { AnswerTimerApi } from '../game/useAnswerTimer';
import type { GamePhase, Team } from '../game/gameTypes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./audio', () => ({
  unlockAudio: vi.fn(),
}));

vi.mock('./useTeamButtonHost', () => ({
  useTeamButtonHost: vi.fn(),
}));

vi.mock('./joinAddress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./joinAddress')>();
  return { ...actual, isLoopbackHost: vi.fn(actual.isLoopbackHost) };
});

function makeHost(overrides: Partial<TeamButtonHost> = {}): TeamButtonHost {
  return {
    status: 'open',
    connectedTeamIds: [],
    session: null,
    error: null,
    demoted: false,
    stalled: false,
    startSession: vi.fn(),
    resolveSession: vi.fn(),
    resetButtons: vi.fn(),
    ...overrides,
  };
}

const TEAMS: Team[] = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
];

function Harness({
  phase,
  onApi,
}: {
  phase: GamePhase;
  onApi: (api: AnswerTimerApi) => void;
}) {
  const answerTimer = useAnswerTimer();
  onApi(answerTimer);
  return (
    <TeamButtonPanel
      teams={TEAMS}
      phase={phase}
      activeTeamId={null}
      noAnswerTeamIds={[]}
      onSetActiveTeam={() => {}}
      onMarkNoAnswer={() => {}}
      onSetStealTeam={() => {}}
      answerTimer={answerTimer}
    />
  );
}

function mount(loopback: boolean): { root: Root; unmount: () => void } {
  vi.mocked(isLoopbackHost).mockReturnValue(loopback);
  vi.mocked(useTeamButtonHost).mockReturnValue(makeHost());

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness phase="tossup" onApi={() => {}} />);
  });
  return {
    root,
    unmount: () => act(() => root.unmount()),
  };
}

describe('TeamButtonPanel join-address QR guard', () => {
  beforeEach(() => {
    vi.mocked(useTeamButtonHost).mockReturnValue(makeHost());
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('shows the QR warning when the host is on a loopback address', () => {
    const { unmount } = mount(true);
    const panel = document.body.querySelector('.tb-panel') as HTMLElement;

    expect(panel.querySelector('.tb-join-warning')).toBeTruthy();
    expect(panel.querySelector('.tb-join-qr')).toBeNull();
    expect(panel.textContent).toContain("TEAM BUTTON QR NEEDS YOUR MAC'S WI-FI ADDRESS");
    unmount();
  });

  it('keeps the QR and typed URL when the host is on a LAN address', () => {
    const { unmount } = mount(false);
    const panel = document.body.querySelector('.tb-panel') as HTMLElement;

    expect(panel.querySelector('.tb-join-warning')).toBeNull();
    expect(panel.querySelector('.tb-join-qr')).toBeTruthy();
    const code = panel.querySelector('.tb-join-url code');
    expect(code?.textContent).toMatch(/\/team-button$/);
    unmount();
  });
});
