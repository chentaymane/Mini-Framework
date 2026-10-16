import { h } from "../framework/index.js";
import {
  addTodo, toggleTodo, toggleAll, deleteTodo, clearCompleted, startEdit, cancelEdit, saveEdit,
} from "./actions.js";

const ENTER = "Enter";
const ESCAPE = "Escape";

function todoItem(todo, editingId) {
  const editing = todo.id === editingId;
  const classes = [todo.completed && "completed", editing && "editing"].filter(Boolean).join(" ");

  return h("li", { key: todo.id, class: classes, "data-testid": "todo-item" },
    h("div", { class: "view" },
      h("input", {
        class: "toggle",
        type: "checkbox",
        "data-testid": "todo-item-toggle",
        checked: todo.completed,
        onChange: () => toggleTodo(todo.id),
      }),
      h("label", { "data-testid": "todo-item-label", onDblclick: () => startEdit(todo.id) }, todo.title),
      h("button", { class: "destroy", "data-testid": "todo-item-button", "aria-label": "Delete todo", onClick: () => deleteTodo(todo.id) })
    ),
    editing && h("input", {
      class: "edit",
      "data-testid": "text-input",
      "aria-label": "Edit todo",
      type: "text",
      autofocus: true,
      value: todo.title,
      onKeydown: e => {
        if (e.key === ENTER) saveEdit(todo.id, e.target.value);
        if (e.key === ESCAPE) cancelEdit();
      },
      onBlur: e => saveEdit(todo.id, e.target.value),
    })
  );
}

function filterLink(href, label, route) {
  return h("li", {}, h("a", { class: route === href ? "selected" : "", href: "#" + href }, label));
}

// header, main and footer go directly inside <section class="todoapp" id="root">
export function view(state) {
  const { todos, route, editingId } = state;
  const active = todos.filter(t => !t.completed);
  const completed = todos.filter(t => t.completed);
  const visible = route === "/active" ? active : route === "/completed" ? completed : todos;
  const allCompleted = todos.length > 0 && todos.every(t => t.completed);

  return [
    h("header", { class: "header", "data-testid": "header" },
      h("h1", {}, "todos"),
      h("input", {
        class: "new-todo",
        "data-testid": "text-input",
        "aria-label": "New Todo Input",
        placeholder: "What needs to be done?",
        type: "text",
        autofocus: true,
        onKeydown: e => {
          if (e.key !== ENTER) return;
          addTodo(e.target.value);
          e.target.value = "";
        },
      })
    ),
    h("main", { class: "main", "data-testid": "main", hidden: todos.length === 0 },
      h("div", { class: "toggle-all-container" },
        h("input", {
          class: "toggle-all",
          id: "toggle-all",
          "data-testid": "toggle-all",
          type: "checkbox",
          checked: allCompleted,
          onChange: () => toggleAll(!allCompleted),
        }),
        h("label", { class: "toggle-all-label", for: "toggle-all" }, "Toggle All Input")
      ),
      h("ul", { class: "todo-list", "data-testid": "todo-list" }, visible.map(t => todoItem(t, editingId)))
    ),
    h("footer", { class: "footer", "data-testid": "footer", hidden: todos.length === 0 },
      h("span", { class: "todo-count" }, `${active.length} ${active.length === 1 ? "item" : "items"} left!`),
      h("ul", { class: "filters", "data-testid": "footer-navigation" },
        filterLink("/", "All", route),
        filterLink("/active", "Active", route),
        filterLink("/completed", "Completed", route)
      ),
      h("button", { class: "clear-completed", hidden: completed.length === 0, onClick: clearCompleted }, "Clear completed")
    ),
  ];
}
