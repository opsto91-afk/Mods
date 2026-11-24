import { Action } from '../store';

interface Props {
  notes: string;
  dispatch: (a: Action) => void;
}

const QUICK_CHIPS = [
  'Pehle meaning aur real problem batao, definition sabse last me',
  'Basic blocks se shuru karke step-by-step deep level pe le jao',
  'Har baar naya real-world example do',
  'Chhote 3-4 line ke steps me samjhao',
];

export function NotesPane({ notes, dispatch }: Props) {
  const addChip = (line: string) => {
    const cur = notes.trim();
    if (cur.includes(line)) return;
    dispatch({ t: 'notes', value: cur ? `${cur}\n• ${line}` : `• ${line}` });
  };

  return (
    <div className="pane notes-pane">
      <div className="notes-card">
        <div className="notes-head">
          <div>
            <div className="brain-title">Personal Memory Notes (AI Read + Write)</div>
            <div className="brain-sub">
              AI har chat me inhe padhta hai, aur baat karte waqt khud bhi naye points yahan save kar sakta hai
            </div>
          </div>
          {notes.trim() && (
            <button className="btn sm" onClick={() => dispatch({ t: 'notes', value: '' })}>
              Clear
            </button>
          )}
        </div>

        <div className="chip-row">
          {QUICK_CHIPS.map((c) => (
            <button key={c} className="chip-btn" onClick={() => addChip(c)}>
              + {c}
            </button>
          ))}
        </div>

        <textarea
          className="notes-area"
          value={notes}
          onChange={(e) => dispatch({ t: 'notes', value: e.target.value })}
          placeholder="Tumhari learning preferences, goals, ya AI ke auto-saved notes yahan dikhenge…"
        />
      </div>
    </div>
  );
}
