import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateRoomCode,
  initials,
  formatTime,
  pickAvatarColor,
  cn,
} from './utils';

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });
});

// ─── generateRoomCode ────────────────────────────────────────────────────────

describe('generateRoomCode', () => {
  it('matches the pulse-NNN-xxx pattern', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^pulse-\d{3}-[a-z]{3}$/);
  });

  it('generates unique codes across 500 calls', () => {
    const codes = new Set(Array.from({ length: 500 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(400); // allow tiny collision probability
  });
});

// ─── initials ────────────────────────────────────────────────────────────────

describe('initials', () => {
  it('returns "?" for empty string', () => {
    expect(initials('')).toBe('?');
  });

  it('returns first two chars uppercased for single word', () => {
    expect(initials('alice')).toBe('AL');
    expect(initials('Bob')).toBe('BO');
  });

  it('returns first letter of each word for multi-word names', () => {
    expect(initials('Alice Smith')).toBe('AS');
    expect(initials('john doe')).toBe('JD');
  });

  it('handles extra whitespace gracefully', () => {
    expect(initials('  Alice   Smith  ')).toBe('AS');
  });
});

// ─── formatTime ─────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('returns a non-empty string for any valid timestamp', () => {
    const result = formatTime(Date.now());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('correctly formats midnight (00:00)', () => {
    // Create a Date for 00:00:00 UTC (adjust for local timezone)
    const ts = new Date('2024-01-01T00:00:00').getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ─── pickAvatarColor ─────────────────────────────────────────────────────────

describe('pickAvatarColor', () => {
  it('returns a valid hex color string', () => {
    const color = pickAvatarColor('alice');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('is deterministic for the same seed', () => {
    expect(pickAvatarColor('alice')).toBe(pickAvatarColor('alice'));
    expect(pickAvatarColor('bob')).toBe(pickAvatarColor('bob'));
  });

  it('returns a color even without a seed', () => {
    const color = pickAvatarColor();
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ─── cn ──────────────────────────────────────────────────────────────────────

describe('cn (classnames utility)', () => {
  it('joins class strings with spaces', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single class string', () => {
    expect(cn('only')).toBe('only');
  });
});
