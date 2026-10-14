import { createStore } from "../framework/index.js";

const STORAGE_KEY = "todos-mini-framework";

// ---------- state ----------
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
export const store = createStore({ todos: saved, route: "/", editingId: null });

store.subscribe(state => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos)));

// ---------- actions ----------
export function setRoute(route) {
  store.setState({ route });
}

export function addTodo(title) {
  title = title.trim();
  if (!title) return;
  store.setState(s => {
    const id = Math.max(0, ...s.todos.map(t => t.id)) + 1;
    return { todos: [{ id, title, completed: false }, ...s.todos] };
  });
}

export function toggleTodo(id) {
  store.setState(s => ({
    todos: s.todos.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)),
  }));
}

export function toggleAll(completed) {
  store.setState(s => ({ todos: s.todos.map(t => ({ ...t, completed })) }));
}

export function deleteTodo(id) {
  store.setState(s => ({ todos: s.todos.filter(t => t.id !== id) }));
}

export function clearCompleted() {
  store.setState(s => ({ todos: s.todos.filter(t => !t.completed) }));
}

export function startEdit(id) {
  store.setState({ editingId: id });
}

export function cancelEdit() {
  store.setState({ editingId: null });
}

export function saveEdit(id, title) {
  // ignore the blur that can fire after Enter/Escape already finished editing
  if (store.getState().editingId !== id) return;
  title = title.trim();
  if (!title) {
    store.setState(s => ({ todos: s.todos.filter(t => t.id !== id), editingId: null }));
    return;
  }
  store.setState(s => ({
    todos: s.todos.map(t => (t.id === id ? { ...t, title } : t)),
    editingId: null,
  }));
}
