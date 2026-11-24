import { describe, expect, it } from 'vitest';
import { reducer, Action } from '../store';
import { initialState, AppState, uid } from '../types';

function seed(): AppState {
  return initialState();
}

describe('reducer — topics (branch tree)', () => {
  it('addTopic root aur child dono banata hai, child handoff leta hai', () => {
    let s = seed();
    s = reducer(s, { t: 'addTopic', title: 'Economics', parentId: null });
    const root = s.topics.find((t) => t.title === 'Economics')!;
    expect(root).toBeTruthy();
    expect(root.parentId).toBeNull();

    s = reducer(s, {
      t: 'addTopic',
      title: 'Gold Standard',
      parentId: root.id,
      handoff: 'Parent ka pehla sawal: "BOP kya hai"',
    });
    const child = s.topics.find((t) => t.title === 'Gold Standard')!;
    expect(child.parentId).toBe(root.id);
    expect(child.handoff).toContain('BOP');
    // naya topic khulta hai (pane chat pe)
    expect(s.activeTopicId).toBe(child.id);
    expect(s.pane).toBe('chat');
  });

  it('delTopic bachon ko saath me delete karta hai (cascade)', () => {
    let s = seed();
    s = reducer(s, { t: 'addTopic', title: 'Root', parentId: null });
    const root = s.topics.find((t) => t.title === 'Root')!;
    s = reducer(s, { t: 'addTopic', title: 'Child1', parentId: root.id });
    s = reducer(s, { t: 'addTopic', title: 'Child2', parentId: root.id });
    const child1 = s.topics.find((t) => t.title === 'Child1')!;
    s = reducer(s, { t: 'addTopic', title: 'GrandChild', parentId: child1.id });

    // General + Root + Child1 + Child2 + GrandChild = 5
    expect(s.topics.length).toBe(5);
    s = reducer(s, { t: 'delTopic', id: root.id });
    // root + child1 + child2 + grandchild sab delete (sirf General bachta hai)
    expect(s.topics.length).toBe(1);
    expect(s.topics[0].title).toBe('General');
  });

  it('delTopic active topic delete ho to kisi aur pe jump', () => {
    let s = seed();
    s = reducer(s, { t: 'addTopic', title: 'Temp', parentId: null });
    const temp = s.topics.find((t) => t.title === 'Temp')!;
    expect(s.activeTopicId).toBe(temp.id);
    s = reducer(s, { t: 'delTopic', id: temp.id });
    expect(s.activeTopicId).not.toBe(temp.id);
    expect(s.topics.some((t) => t.id === s.activeTopicId)).toBe(true);
  });

  it('saare topics delete ho to ek General fallback bachta hai', () => {
    let s = seed();
    const all = s.topics.map((t) => t.id);
    for (const id of all) s = reducer(s, { t: 'delTopic', id });
    expect(s.topics.length).toBe(1);
    expect(s.topics[0].title).toBe('General');
  });
});

describe('reducer — messages', () => {
  it('pushMsg sirf us topic me daalta hai (context isolation)', () => {
    let s = seed();
    s = reducer(s, { t: 'addTopic', title: 'A', parentId: null });
    s = reducer(s, { t: 'addTopic', title: 'B', parentId: null });
    const a = s.topics.find((t) => t.title === 'A')!;
    const b = s.topics.find((t) => t.title === 'B')!;

    s = reducer(s, {
      t: 'pushMsg',
      topicId: a.id,
      msg: { id: uid(), role: 'user', text: 'sawal A', ts: Date.now() },
    });

    expect(s.topics.find((t) => t.id === a.id)!.messages.length).toBe(1);
    expect(s.topics.find((t) => t.id === b.id)!.messages.length).toBe(0);
  });

  it('setTopicMsgs replace karta hai (stuck/regenerate ke liye)', () => {
    let s = seed();
    const t0 = s.topics[0];
    s = reducer(s, {
      t: 'pushMsg',
      topicId: t0.id,
      msg: { id: 'm1', role: 'user', text: 'q', ts: 1 },
    });
    s = reducer(s, {
      t: 'pushMsg',
      topicId: t0.id,
      msg: { id: 'm2', role: 'assistant', text: 'old', ts: 2 },
    });
    s = reducer(s, {
      t: 'setTopicMsgs',
      topicId: t0.id,
      msgs: [
        { id: 'm1', role: 'user', text: 'q', ts: 1 },
        { id: 'm3', role: 'assistant', text: 'new', ts: 3 },
      ],
    });
    const msgs = s.topics.find((t) => t.id === t0.id)!.messages;
    expect(msgs.length).toBe(2);
    expect(msgs[1].text).toBe('new');
  });
});

describe('reducer — notes / usage / settings', () => {
  it('notes overwrite hote hain (clear + append user side)', () => {
    let s = seed();
    s = reducer(s, { t: 'notes', value: 'pehli line' });
    expect(s.notes).toBe('pehli line');
    s = reducer(s, { t: 'notes', value: '' });
    expect(s.notes).toBe('');
  });

  it('usage accumulate hota hai', () => {
    let s = seed();
    s = reducer(s, { t: 'usage', chars: 100, requests: 1 });
    s = reducer(s, { t: 'usage', chars: 50, requests: 1 });
    expect(s.usage).toEqual({ chars: 150, requests: 2 });
  });

  it('settings patch merge hota hai (provider switch)', () => {
    let s = seed();
    s = reducer(s, { t: 'settings', patch: { activeId: 'gemini', mode: 'text' } });
    expect(s.settings.activeId).toBe('gemini');
    expect(s.settings.mode).toBe('text');
    // baaki settings safe
    expect(s.settings.providers.length).toBeGreaterThan(0);
    expect(s.settings.autoFallback).toBe(true);
  });

  it('pane switch hota hai', () => {
    let s = seed();
    s = reducer(s, { t: 'pane', pane: 'map' });
    expect(s.pane).toBe('map');
  });
});

describe('reducer — unknown action safe', () => {
  it('koi galat action state bigadta nahi', () => {
    const s = seed();
    const out = reducer(s, { t: 'nope' } as unknown as Action);
    expect(out).toBe(s);
  });
});
