import type { Action } from '../store';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  dispatch: (a: Action) => void;
}

/**
 * Notes pane — chhoti editable file jo har request ke saath AI ko jaati hai.
 * "Atak gaya" wale buttons yahan entries likhte hain.
 */
export default function NotesPane({ state, dispatch }: Props) {
  const lines = state.notes.split('\n').filter((l) => l.trim());

  return (
    <div className="pane">
      <div className="notes">
        <div className="hint">
          Ye file har AI request ke saath jaati hai (max ~600 chars). Jo yahan likhoge, AI usi hisaab se
          padhayega. Buttons (<i>Atak gaya, Bhaari ho gaya…</i>) khud entries daalte hain — tu edit/delete
          kar sakta hai.
        </div>
        <textarea
          value={state.notes}
          placeholder={'Example:\nDefinition pehle se dikkat, analogy chalta hai\nHar jawab 3-4 line\nExample hamesha naya'}
          onChange={(e) => dispatch({ t: 'notes', value: e.target.value })}
        />
        <div className="muted">
          {lines.length} line{lines.length === 1 ? '' : 's'} · {state.notes.length}/600 chars AI tak jayenge
          {lines.length > 0 && (
            <>
              {' '}
              ·{' '}
              <button
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => {
                  if (confirm('Saari notes entries delete kar dein?')) dispatch({ t: 'notes', value: '' });
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
