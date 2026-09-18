import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import JoinQrCode from './JoinQrCode';

function countRects(html: string): number {
  return (html.match(/<rect/g) ?? []).length;
}

describe('JoinQrCode', () => {
  it('renders an accessible SVG labeled with the encoded value', () => {
    const html = renderToStaticMarkup(<JoinQrCode value="http://192.168.1.20:5173/team-button" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('http://192.168.1.20:5173/team-button');
  });

  it('actually encodes data (more than just the background rect)', () => {
    const html = renderToStaticMarkup(<JoinQrCode value="http://192.168.1.20:5173/team-button" />);
    // 1 background rect + many 1x1 dark module rects for a real URL.
    expect(countRects(html)).toBeGreaterThan(20);
  });

  it('different values produce different content (not a static placeholder)', () => {
    const htmlA = renderToStaticMarkup(<JoinQrCode value="http://192.168.1.20:5173/team-button" />);
    const htmlB = renderToStaticMarkup(<JoinQrCode value="http://10.0.0.5:5175/team-button" />);
    expect(htmlA).not.toBe(htmlB);
  });

  it('respects a custom size', () => {
    const html = renderToStaticMarkup(<JoinQrCode value="http://192.168.1.20:5173/team-button" size={200} />);
    expect(html).toContain('width="200"');
    expect(html).toContain('height="200"');
  });

  it('defaults to a 132px size', () => {
    const html = renderToStaticMarkup(<JoinQrCode value="http://192.168.1.20:5173/team-button" />);
    expect(html).toContain('width="132"');
    expect(html).toContain('height="132"');
  });
});
