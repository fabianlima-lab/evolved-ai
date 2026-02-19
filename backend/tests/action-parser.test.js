import { describe, it, expect } from 'vitest';
import { parseActions, stripActionTags, hasActions } from '../src/utils/action-parser.js';

describe('Action Parser', () => {
  // ── parseActions ──
  describe('parseActions()', () => {
    it('returns empty array for null input', () => {
      expect(parseActions(null)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(parseActions('')).toEqual([]);
    });

    it('returns empty array for text without action tags', () => {
      expect(parseActions('Just a regular message')).toEqual([]);
    });

    it('parses a single action tag with params', () => {
      const text = '[ACTION:create_event title="Dentist" start="2026-03-01T14:00:00"]';
      const actions = parseActions(text);

      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('create_event');
      expect(actions[0].params.title).toBe('Dentist');
      expect(actions[0].params.start).toBe('2026-03-01T14:00:00');
      expect(actions[0].raw).toBe(text);
    });

    it('parses action tag with no params', () => {
      const text = '[ACTION:memory_dump]';
      const actions = parseActions(text);

      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('memory_dump');
      expect(actions[0].params).toEqual({});
    });

    it('parses multiple action tags', () => {
      const text = 'Sure!\n[ACTION:web_search query="restaurants"]\n[ACTION:memory_save category="preferences" fact="Likes sushi"]';
      const actions = parseActions(text);

      expect(actions).toHaveLength(2);
      expect(actions[0].action).toBe('web_search');
      expect(actions[0].params.query).toBe('restaurants');
      expect(actions[1].action).toBe('memory_save');
      expect(actions[1].params.category).toBe('preferences');
      expect(actions[1].params.fact).toBe('Likes sushi');
    });

    it('parses action tags embedded in prose', () => {
      const text = 'I\'ll create that event for you!\n[ACTION:create_event title="Meeting" start="2026-03-01T10:00:00"]\nDone!';
      const actions = parseActions(text);

      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('create_event');
    });

    it('parses send_email with body containing spaces', () => {
      const text = '[ACTION:send_email to="john@example.com" subject="Hello" body="Hey John, how are you?"]';
      const actions = parseActions(text);

      expect(actions).toHaveLength(1);
      expect(actions[0].params.to).toBe('john@example.com');
      expect(actions[0].params.subject).toBe('Hello');
      expect(actions[0].params.body).toBe('Hey John, how are you?');
    });

    it('preserves raw tag for replacement', () => {
      const tag = '[ACTION:calculate expression="2+2"]';
      const text = `Let me calculate that. ${tag} There you go!`;
      const actions = parseActions(text);

      expect(actions[0].raw).toBe(tag);
    });

    it('can be called multiple times (regex lastIndex reset)', () => {
      const text = '[ACTION:web_search query="test"]';
      parseActions(text);
      const second = parseActions(text);
      expect(second).toHaveLength(1);
      expect(second[0].action).toBe('web_search');
    });

    it('parses create_reminder action', () => {
      const text = '[ACTION:create_reminder title="Call dentist" due="2026-03-01T10:00:00"]';
      const actions = parseActions(text);

      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('create_reminder');
      expect(actions[0].params.title).toBe('Call dentist');
      expect(actions[0].params.due).toBe('2026-03-01T10:00:00');
    });

    it('parses mark_read with comma-separated IDs', () => {
      const text = '[ACTION:mark_read ids="msg123,msg456,msg789"]';
      const actions = parseActions(text);

      expect(actions[0].params.ids).toBe('msg123,msg456,msg789');
    });
  });

  // ── stripActionTags ──
  describe('stripActionTags()', () => {
    it('returns empty string for null', () => {
      expect(stripActionTags(null)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(stripActionTags('')).toBe('');
    });

    it('removes a single action tag', () => {
      const text = 'Sure!\n[ACTION:create_event title="Dentist" start="2026-03-01T14:00:00"]\nDone!';
      const result = stripActionTags(text);

      expect(result).not.toContain('[ACTION:');
      expect(result).toContain('Sure!');
      expect(result).toContain('Done!');
    });

    it('removes multiple action tags', () => {
      const text = '[ACTION:web_search query="test"]\nHere are results.\n[ACTION:memory_save category="preferences" fact="test"]';
      const result = stripActionTags(text);

      expect(result).not.toContain('[ACTION:');
      expect(result).toContain('Here are results.');
    });

    it('collapses excessive newlines after stripping', () => {
      const text = 'Hello\n\n\n[ACTION:memory_dump]\n\n\nGoodbye';
      const result = stripActionTags(text);

      expect(result).not.toMatch(/\n{3,}/);
    });

    it('returns plain text unchanged', () => {
      const text = 'No actions here, just a message.';
      expect(stripActionTags(text)).toBe(text);
    });

    it('trims result', () => {
      const text = '  [ACTION:memory_dump]  ';
      expect(stripActionTags(text)).toBe('');
    });
  });

  // ── hasActions ──
  describe('hasActions()', () => {
    it('returns false for null', () => {
      expect(hasActions(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasActions('')).toBe(false);
    });

    it('returns false for plain text', () => {
      expect(hasActions('Hello there!')).toBe(false);
    });

    it('returns true when action tag is present', () => {
      expect(hasActions('[ACTION:web_search query="test"]')).toBe(true);
    });

    it('returns true for memory_dump (no params)', () => {
      expect(hasActions('[ACTION:memory_dump]')).toBe(true);
    });

    it('returns true when tag is embedded in text', () => {
      expect(hasActions('Sure!\n[ACTION:create_event title="Test" start="2026-01-01"]')).toBe(true);
    });

    it('returns false for malformed tags', () => {
      expect(hasActions('[ACTION: broken]')).toBe(false);
      expect(hasActions('[action:lowercase]')).toBe(false);
    });

    it('can be called multiple times (regex lastIndex reset)', () => {
      const text = '[ACTION:web_search query="test"]';
      hasActions(text);
      expect(hasActions(text)).toBe(true);
    });
  });
});
