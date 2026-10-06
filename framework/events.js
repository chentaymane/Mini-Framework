// Events go through the framework: one real listener per event type,
// and on re-render we only swap the handler (no duplicate listeners).
export function setEvent(el, name, handler) {
  el._events ??= {};
  if (!(name in el._events)) {
    el.addEventListener(name, e => el._events[name]?.(e));
  }
  el._events[name] = handler;
}

export function removeEvent(el, name) {
  if (el._events) el._events[name] = null;
}

// Events on window/document (scroll, global keybindings...). Returns a function to stop listening.
export function on(target, name, handler) {
  target.addEventListener(name, handler);
  return () => target.removeEventListener(name, handler);
}
