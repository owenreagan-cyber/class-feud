import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AnswerBoard from './AnswerBoard';
import type { FeudAnswer } from '../../game/gameTypes';

function answer(overrides: Partial<FeudAnswer>): FeudAnswer {
  return {
    id: 'a',
    text: 'Pizza',
    aliases: [],
    points: 32,
    revealed: false,
    ...overrides,
  };
}

describe('AnswerBoard', () => {
  it('renders a numbered unrevealed tile with no answer/point leakage', () => {
    const html = renderToStaticMarkup(
      <AnswerBoard answers={[answer({ id: 'a1', text: 'Pizza', points: 32 })]} />,
    );
    expect(html).toContain('answer-slot-number');
    expect(html).toContain('1'); // position number
    expect(html).not.toContain('Pizza'); // answer text hidden
    expect(html).not.toContain('32'); // points hidden
  });

  it('reveals the answer text and point value once revealed', () => {
    const html = renderToStaticMarkup(
      <AnswerBoard answers={[answer({ id: 'a1', text: 'Pizza', points: 32, revealed: true })]} />,
    );
    expect(html).toContain('Pizza');
    expect(html).toContain('32');
  });

  it('numbers tiles by position and keeps neighboring tiles hidden', () => {
    const html = renderToStaticMarkup(
      <AnswerBoard
        answers={[
          answer({ id: 'a1', text: 'Alpha', points: 40, revealed: true }),
          answer({ id: 'a2', text: 'Beta', points: 25 }),
          answer({ id: 'a3', text: 'Gamma', points: 15 }),
        ]}
      />,
    );
    // Only the revealed answer leaks its text; the rest stay hidden.
    expect(html).toContain('Alpha');
    expect(html).toContain('40');
    expect(html).not.toContain('Beta');
    expect(html).not.toContain('25');
    expect(html).not.toContain('Gamma');
    expect(html).not.toContain('15');
  });

  it('supports 3-digit point values', () => {
    const html = renderToStaticMarkup(
      <AnswerBoard answers={[answer({ id: 'a1', text: 'Long', points: 100, revealed: true })]} />,
    );
    expect(html).toContain('100');
  });

  it('renders long answers without truncation', () => {
    const long = 'A remarkably long multi-word answer that should stay readable';
    const html = renderToStaticMarkup(
      <AnswerBoard answers={[answer({ id: 'a1', text: long, points: 12, revealed: true })]} />,
    );
    expect(html).toContain(long);
  });
});
