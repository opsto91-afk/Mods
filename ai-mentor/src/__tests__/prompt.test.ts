import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, fingerprint } from '../prompt';

describe('buildSystemPrompt', () => {
  it('core teaching rules hamesha jaate hain', () => {
    const p = buildSystemPrompt({ notes: '', handoff: null, mode: 'auto' });
    expect(p).toContain('2+2');
    expect(p).toContain('20+20');
    expect(p).toContain('meaning');
    expect(p).toContain('label');
    expect(p).toContain('diagram');
    // definition last rule
    expect(p).toMatch(/LAST/i);
  });

  it('notes include hote hain, khali hona chaloo hai', () => {
    const withNotes = buildSystemPrompt({
      notes: 'Definition pehle se dikkat, analogy chalta hai',
      handoff: null,
      mode: 'auto',
    });
    expect(withNotes).toContain('Definition pehle se dikkat');
    const empty = buildSystemPrompt({ notes: '   ', handoff: null, mode: 'auto' });
    expect(empty).toContain('khaali');
  });

  it('notes 600 chars se zyada nahi jaate (token cap)', () => {
    const long = 'x'.repeat(2000);
    const p = buildSystemPrompt({ notes: long, handoff: null, mode: 'auto' });
    // prompt me notes ki entry ~600 chars + surrounding text
    expect(p.length).toBeLessThan(4500);
  });

  it('handoff branch context ke roop me jaata hai', () => {
    const p = buildSystemPrompt({
      notes: '',
      handoff: 'Parent ka pehla sawal: "Gold Standard kya hai"',
      mode: 'auto',
    });
    expect(p).toContain('BRANCH HANDOFF');
    expect(p).toContain('Gold Standard');
  });

  it('seedha mode direct jawab maangta hai', () => {
    const p = buildSystemPrompt({ notes: '', handoff: null, mode: 'auto', seedha: true });
    expect(p).toContain('SEEDHA');
    expect(p).toMatch(/Socratic sawal mat/i);
  });

  it('stuck mode naya angle + chhota piece maangta hai', () => {
    const p = buildSystemPrompt({ notes: '', handoff: null, mode: 'auto', stuck: true });
    expect(p).toContain('STUCK');
    expect(p).toContain('naye angle');
    expect(p).toContain('2-3 line');
  });

  it('visual modes diagram block ka instruction dete hain', () => {
    const d = buildSystemPrompt({ notes: '', handoff: null, mode: 'auto', visual: 'diagram' });
    expect(d).toContain('DIKHAO');
    expect(d).toContain('```diagram');
    const a = buildSystemPrompt({ notes: '', handoff: null, mode: 'auto', visual: 'animate' });
    expect(a).toContain('CHALAKE DIKHAO');
    expect(a).toContain('frames');
  });

  it('text mode me "kabhi diagram mat do" wala rule active hai', () => {
    const p = buildSystemPrompt({ notes: '', handoff: null, mode: 'text' });
    expect(p).toContain('text mode me diagram block kabhi mat do');
  });
});

describe('fingerprint (lesson cache key)', () => {
  it('case aur extra spaces ignore karta hai', () => {
    const a = fingerprint('t1', 'Gold  Standard kya hai?');
    const b = fingerprint('t1', 'gold standard kya hai?');
    expect(a).toBe(b);
  });

  it('alag topic ka sawal alag cache', () => {
    expect(fingerprint('t1', 'WiFi kaise kaam karta hai')).not.toBe(
      fingerprint('t2', 'WiFi kaise kaam karta hai'),
    );
  });

  it('bahut lambi text cut ho ke fixed rehti hai', () => {
    const k = fingerprint('t1', 'y'.repeat(5000));
    expect(k.length).toBeLessThan(300);
  });
});
