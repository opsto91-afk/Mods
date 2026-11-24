import type { AppState, Topic } from './types';

/** active topic (delete race ho to pehla) */
export function activeTopic(state: AppState): Topic {
  return state.topics.find((t) => t.id === state.activeTopicId) ?? state.topics[0];
}
