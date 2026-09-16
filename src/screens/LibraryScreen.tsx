import { useState } from 'react';
import { BUILT_IN_GAME_SETS } from '../content/builtInGameSets';
import { duplicateGameSet } from '../content/gameSet';
import type { SavedGameSet } from '../content/gameSet';
import { deleteGameSet, loadGameSets, saveGameSet } from '../content/gameSetStore';

type Props = {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onStart: (set: SavedGameSet) => void;
};

type SourceFilter = 'all' | 'custom' | 'builtin';

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LibraryScreen({ onCreateNew, onEdit, onStart }: Props) {
  const [customSets, setCustomSets] = useState<SavedGameSet[]>(() => loadGameSets());
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allSets = [...BUILT_IN_GAME_SETS, ...customSets];

  const visible = allSets.filter((set) => {
    if (filter === 'custom' && set.source !== 'custom') return false;
    if (filter === 'builtin' && set.source !== 'builtin') return false;
    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      if (
        !set.title.toLowerCase().includes(q) &&
        !set.description.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  function duplicate(set: SavedGameSet) {
    const copy = duplicateGameSet(set);
    saveGameSet(copy);
    onEdit(copy.id);
  }

  function remove(id: string) {
    deleteGameSet(id);
    setCustomSets(loadGameSets());
    setConfirmDeleteId(null);
  }

  return (
    <div className="library-screen">
      <header className="library-header">
        <h1 className="library-title">Class Feud</h1>
        <p className="library-subtitle">Choose a game set or create your own.</p>
        <button type="button" className="primary" onClick={onCreateNew}>
          + Create New Game
        </button>
      </header>

      <div className="filter-bar">
        <input
          type="search"
          className="search-input"
          placeholder="Search games…"
          aria-label="Search games"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="filter-tabs" role="group" aria-label="Filter games">
          {(['all', 'custom', 'builtin'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={filter === option ? 'filter-tab filter-tab--on' : 'filter-tab'}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option === 'all' ? 'All' : option === 'custom' ? 'Custom' : 'Built-In'}
            </button>
          ))}
        </div>
      </div>

      <section className="library-section">
        <h2>Your Games</h2>
        {customSets.length === 0 ? (
          <p className="library-empty">
            No custom games yet. Duplicate a built-in demo or create a new game.
          </p>
        ) : null}
        <div className="game-list">
          {visible.map((set) => (
            <article key={set.id} className="game-card">
              <div className="game-card-info">
                <div className="game-card-title-row">
                  <h3>{set.title}</h3>
                  <span className={set.source === 'builtin' ? 'badge badge--builtin' : 'badge'}>
                    {set.source === 'builtin' ? 'Built-In' : 'Custom'}
                  </span>
                </div>
                {set.description ? <p className="game-card-desc">{set.description}</p> : null}
                <span className="game-card-meta">
                  {set.rounds.length} {set.rounds.length === 1 ? 'round' : 'rounds'} · Updated{' '}
                  {formatUpdated(set.updatedAt)}
                </span>
              </div>
              <div className="game-card-actions">
                <button type="button" className="primary" onClick={() => onStart(set)}>
                  Start Game
                </button>
                {set.source === 'custom' ? (
                  <button type="button" onClick={() => onEdit(set.id)}>
                    Edit
                  </button>
                ) : null}
                <button type="button" onClick={() => duplicate(set)}>
                  Duplicate
                </button>
                {set.source === 'custom' ? (
                  confirmDeleteId === set.id ? (
                    <span className="delete-confirm">
                      <span className="delete-confirm-text">Delete “{set.title}”?</span>
                      <button type="button" className="danger" onClick={() => remove(set.id)}>
                        Delete
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setConfirmDeleteId(set.id)}
                    >
                      Delete
                    </button>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
