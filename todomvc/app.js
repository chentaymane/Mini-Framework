// TodoMVC built with Hdo.
var h = Hdo.h;
var ENTER = 'Enter';
var ESCAPE = 'Escape';

// ---- state ---------------------------------------------------------

Hdo.setState({
  todos: JSON.parse(localStorage.getItem('todos-hdo') || '[]'),
  editing: null // id of the todo being edited
});

// '#/', '#/active' and '#/completed' become state.route
Hdo.router();

// save the todos every time the state changes
Hdo.subscribe(function (state) {
  localStorage.setItem('todos-hdo', JSON.stringify(state.todos));
});

// ---- actions -------------------------------------------------------

function todos() {
  return Hdo.getState().todos;
}

function addTodo(title) {
  title = title.trim();
  if (!title) return;
  Hdo.setState({ todos: todos().concat({ id: Date.now(), title: title, completed: false }) });
}

function updateTodo(id, changes) {
  Hdo.setState({
    todos: todos().map(function (t) { return t.id === id ? Object.assign({}, t, changes) : t; })
  });
}

function removeTodo(id) {
  Hdo.setState({ todos: todos().filter(function (t) { return t.id !== id; }) });
}

function toggleAll(completed) {
  Hdo.setState({
    todos: todos().map(function (t) { return Object.assign({}, t, { completed: completed }); })
  });
}

function clearCompleted() {
  Hdo.setState({ todos: todos().filter(function (t) { return !t.completed; }) });
}

function saveEdit(id, title) {
  if (Hdo.getState().editing !== id) return; // already saved or cancelled
  title = title.trim();
  Hdo.setState({ editing: null });
  if (title) updateTodo(id, { title: title });
  else removeTodo(id);
}

// ---- views ---------------------------------------------------------

function todoItem(todo) {
  var editing = Hdo.getState().editing === todo.id;
  var className = [todo.completed ? 'completed' : '', editing ? 'editing' : ''].join(' ').trim();

  return h('li', { key: todo.id, class: className || null }, [
    h('div', { class: 'view' }, [
      h('input', {
        class: 'toggle',
        type: 'checkbox',
        checked: todo.completed,
        on: { change: function () { updateTodo(todo.id, { completed: !todo.completed }); } }
      }),
      h('label', {
        on: { dblclick: function () { Hdo.setState({ editing: todo.id }); } }
      }, todo.title),
      h('button', { class: 'destroy', on: { click: function () { removeTodo(todo.id); } } })
    ]),
    editing && h('input', {
      class: 'edit',
      value: todo.title,
      autofocus: true,
      on: {
        keydown: function (e) {
          if (e.key === ENTER) saveEdit(todo.id, e.target.value);
          if (e.key === ESCAPE) Hdo.setState({ editing: null });
        },
        blur: function (e) { saveEdit(todo.id, e.target.value); }
      }
    })
  ]);
}

function filterLink(route, label) {
  var current = Hdo.getState().route;
  return h('li', null, h('a', { href: '#' + route, class: current === route ? 'selected' : null }, label));
}

function app() {
  var state = Hdo.getState();
  var all = state.todos;
  var active = all.filter(function (t) { return !t.completed; });
  var completed = all.filter(function (t) { return t.completed; });
  var visible = state.route === '/active' ? active : state.route === '/completed' ? completed : all;

  return h('section', { class: 'todoapp' }, [
    h('header', { class: 'header' }, [
      h('h1', null, 'todos'),
      h('input', {
        class: 'new-todo',
        placeholder: 'What needs to be done?',
        autofocus: true,
        on: {
          keydown: function (e) {
            if (e.key !== ENTER) return;
            addTodo(e.target.value);
            e.target.value = '';
          }
        }
      })
    ]),

    // main and footer are hidden when there are no todos
    all.length > 0 && h('section', { class: 'main' }, [
      h('input', {
        id: 'toggle-all',
        class: 'toggle-all',
        type: 'checkbox',
        checked: active.length === 0,
        on: { change: function (e) { toggleAll(e.target.checked); } }
      }),
      h('label', { for: 'toggle-all' }, 'Mark all as complete'),
      h('ul', { class: 'todo-list' }, visible.map(todoItem))
    ]),

    all.length > 0 && h('footer', { class: 'footer' }, [
      h('span', { class: 'todo-count' }, [
        h('strong', null, active.length),
        active.length === 1 ? ' item left' : ' items left'
      ]),
      h('ul', { class: 'filters' }, [
        filterLink('/', 'All'),
        filterLink('/active', 'Active'),
        filterLink('/completed', 'Completed')
      ]),
      completed.length > 0 && h('button', { class: 'clear-completed', on: { click: clearCompleted } }, 'Clear completed')
    ])
  ]);
}

Hdo.mount(app, document.getElementById('app'));
