// One global store: read with getState, change with setState,
// start listening with subscribe, stop listening with unsubscribe
export function createStore(initialState) {
  let state = initialState;
  const listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
    return () => unsubscribe(fn);
  }

  function unsubscribe(fn) {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  }

  return {
    getState: () => state,
    setState(update) {
      const changes = typeof update === "function" ? update(state) : update;
      state = { ...state, ...changes };
      listeners.forEach(fn => fn(state));
    },
    subscribe,
    unsubscribe,
  };
}
