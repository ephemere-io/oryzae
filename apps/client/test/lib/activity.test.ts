import { describe, expect, it } from 'vitest';
import { ACTIVITY_EVENT, notifyActivity, readActivityKind } from '@/lib/activity';

describe('activity — 成し遂げた合図', () => {
  it('window のイベントで種類だけを伝える', () => {
    const heard: string[] = [];
    const listener = (event: Event) => {
      const kind = readActivityKind(event);
      if (kind) heard.push(kind);
    };
    window.addEventListener(ACTIVITY_EVENT, listener);
    notifyActivity('question');
    notifyActivity('entry');
    notifyActivity('pickle');
    notifyActivity('read');
    window.removeEventListener(ACTIVITY_EVENT, listener);
    expect(heard).toEqual(['question', 'entry', 'pickle', 'read']);
  });

  it('自前でないイベントや知らない種類は読まない', () => {
    expect(readActivityKind(new Event(ACTIVITY_EVENT))).toBeNull();
    expect(readActivityKind(new CustomEvent(ACTIVITY_EVENT, { detail: 'delete' }))).toBeNull();
    expect(readActivityKind(new CustomEvent(ACTIVITY_EVENT, { detail: 'link' }))).toBe('link');
    expect(readActivityKind(new CustomEvent(ACTIVITY_EVENT, { detail: 'entry' }))).toBe('entry');
    expect(readActivityKind(new CustomEvent(ACTIVITY_EVENT, { detail: 'read' }))).toBe('read');
  });
});
