import { describe, expect, it } from 'vitest';
import { extractDiagram } from '../components/Stage';

describe('extractDiagram (AI ke JSON instructions)', () => {
  it('valid pie block parse hota hai', () => {
    const text = `Samajh aaya?
\`\`\`diagram
{"template":"pie","title":"Budget","parts":[{"label":"Health","value":30},{"label":"Army","value":70}]}
\`\`\``;
    const spec = extractDiagram(text);
    expect(spec).not.toBeNull();
    expect(spec!.template).toBe('pie');
    expect(spec!.parts).toHaveLength(2);
    expect(spec!.title).toBe('Budget');
  });

  it('diagram ke bina null', () => {
    expect(extractDiagram('Sirf text wala jawab.')).toBeNull();
  });

  it('gala JSON null deta hai (app crash nahi)', () => {
    expect(extractDiagram('```diagram\n{kharab json```\n')).toBeNull();
    expect(extractDiagram('```diagram\n[]\n```')).toBeNull();
    expect(extractDiagram('```diagram\n{"foo":1}\n```')).toBeNull();
  });

  it('text + diagram dono ho to text chip ke liye bhi kaam kare', () => {
    const text = 'Dekh graph:\n```diagram\n{"template":"line","series":[{"name":"gdp","points":[1,2,3]}]}\n```';
    const spec = extractDiagram(text);
    expect(spec!.template).toBe('line');
    expect(spec!.series![0].points).toEqual([1, 2, 3]);
  });

  it('flow aur arrows bhi parse hote hain', () => {
    const flow = extractDiagram('```diagram\n{"template":"flow","steps":["a","b","c"]}\n```');
    expect(flow!.steps).toHaveLength(3);
    const arrows = extractDiagram(
      '```diagram\n{"template":"arrows","frames":[{"items":[{"x":10,"y":20}]}]}\n```',
    );
    expect(arrows!.frames).toHaveLength(1);
  });
});
