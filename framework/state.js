// One global store: read with getState, change with setState, react with subscribe
export function createStore(initialState) {
  let state = initialState;
  const listeners = [];
  return {
    getState: () => state,
    setState(update) {
      const changes = typeof update === "function" ? update(state) : update;
      state = { ...state, ...changes };
      listeners.forEach(fn => fn(state));
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
}
