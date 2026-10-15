# mini-framework

A tiny JavaScript framework, built from scratch with no external libraries.
It has 4 features:

1. **DOM abstraction**: describe the UI with plain objects (virtual nodes) using `h()`.
2. **Routing**: keep the URL (`#/...`) in sync with the app state.
3. **State management**: one global store that any part of the app can read and change.
4. **Event handling**: attach events with `onClick`, `onKeydown` and so on. You never call `addEventListener` yourself.

A full [TodoMVC](https://todomvc.com) app built with the framework lives in [`todomvc/`](./todomvc/).

## How to run

The framework uses ES modules, so you need a local server (opening the file directly will not work). Run it from the project root:

```bash
python3 -m http.server 8080
```

Then open:

- http://localhost:8080/: counter demo and links
- http://localhost:8080/todomvc/: the TodoMVC app

## Project structure

```
framework/           state, routing, events and DOM abstraction
  state.js           createStore
  router.js          createRouter
  events.js          event system
  dom.js             h(), createElement, patch (diff), mount
  index.js           public API
todomvc/             TodoMVC app built with the framework
  index.html         page
  style.css          official TodoMVC styles
  actions.js         store, actions (add, toggle, edit...)
  view.js            the TodoMVC UI (header, list, footer)
  app.js             entry point: router + mount
index.html           counter demo and links
README.md            this documentation
```

## Usage

Import everything from `framework/index.js` (the path is relative to your file):

```js
import { h, mount, on, createStore, createRouter } from "./framework/index.js";
```

### Create an element

`h(tag, attrs, ...children)` returns a virtual node:

```js
h("div", { class: "box" }, "hello");
// { tag: "div", attrs: { class: "box" }, children: ["hello"] }
```

### Add attributes

Pass attributes in the second argument:

```js
h("input", { type: "text", placeholder: "Your name", class: "field", id: "name" });
h("input", { type: "checkbox", checked: true });   // checked / value are set as properties
h("button", { disabled: true }, "Can't click");    // true -> attribute is present
h("button", { disabled: false }, "Click");         // false / null -> attribute removed
```

`style` can be a string or an object. With an object, only the properties that changed are written to the DOM:

```js
h("div", { style: "color: red; font-size: 20px" });
h("div", { style: { transform: `translate(${x}px, ${y}px)`, backgroundColor: "red", "--size": "32px" } });
```

### Nest elements

Children can be strings, numbers, other `h()` nodes, or arrays of nodes.
`null`, `undefined`, `true` and `false` are skipped, which makes conditional rendering easy:

```js
h("ul", { class: "list" },
  items.map(item => h("li", {}, item)),
  items.length === 0 && h("li", {}, "Nothing here")
);
```

### Add an event

Use `on` + the event name as an attribute:

```js
h("button", { onClick: () => alert("clicked") }, "Click me");
h("input", { onKeydown: e => { if (e.key === "Enter") console.log(e.target.value); } });
h("label", { onDblclick: () => console.log("double click") }, "Edit me");
h("input", { onBlur: () => console.log("left the field") });
```

Any DOM event works: `onClick`, `onChange`, `onInput`, `onKeydown`, `onKeyup`, `onDblclick`, `onBlur`, `onScroll`, and so on.
The event name is everything after `on`, in lowercase, so double click is `onDblclick` (the DOM event is `dblclick`).

A handler can be `null` to turn it off, for example `onClick: canPlay ? play : null`.

For events on the whole page (window scroll, global keybindings), use `on(target, eventName, handler)`. It returns a function that stops listening:

```js
import { on } from "./framework/index.js";

const stop = on(window, "scroll", () => console.log(window.scrollY));
on(document, "keydown", e => { if (e.key === "Escape") console.log("Escape pressed"); });

stop(); // stop listening to scroll
```

### State: `createStore`

```js
const store = createStore({ count: 0 });

store.getState();                                   // { count: 0 }
store.setState({ count: 5 });                       // merge an object
store.setState(s => ({ count: s.count + 1 }));      // or use a function of the old state
const unsubscribe = store.subscribe(state => console.log(state));
```

### Rendering: `mount`

`mount(view, root, store)` renders `view(state)` into `root` and re-renders automatically every time the state changes:

```js
const store = createStore({ count: 0 });

const view = s => h("div", {},
  h("p", {}, `Count: ${s.count}`),
  h("button", { onClick: () => store.setState({ count: s.count + 1 }) }, "+")
);

mount(view, document.getElementById("app"), store);
```

You never touch the DOM. You change the state, and the framework updates the page.

`view` can also return an **array** of nodes. They are all rendered side by side inside `root`:

```js
const view = s => [
  h("header", {}, h("h1", {}, "Title")),
  h("main", {}, `Count: ${s.count}`),
];
```

### Lists: the `key` attribute

When a list can change in the middle (items removed, added or reordered), give each item a unique `key`:

```js
h("ul", {}, todos.map(t => h("li", { key: t.id }, t.title)));
```

With keys, each DOM element stays attached to its item. Removing the 2nd item removes only that `<li>`; the others are not touched.
Without keys, items are compared by position. `key` is only used by the framework and is not written to the HTML.

### Routing: `createRouter`

The router reads the URL hash and calls your function on load and every time the URL changes. Put the route in the store, and the UI follows it:

```js
const store = createStore({ route: "/" });
const router = createRouter(path => store.setState({ route: path }));

// links just use hrefs
h("a", { href: "#/about" }, "About");

// or navigate from code
router.navigate("/about");
router.current();          // "/about"

// in the view
const view = s => s.route === "/about" ? h("h1", {}, "About") : h("h1", {}, "Home");
```

### Example: a small form

```js
const store = createStore({ name: "", submitted: null });

const view = s => h("form", { onSubmit: e => { e.preventDefault(); store.setState({ submitted: s.name }); } },
  h("input", { placeholder: "Name", value: s.name, onInput: e => store.setState({ name: e.target.value }) }),
  h("button", { type: "submit" }, "Send"),
  s.submitted && h("p", {}, `Hello ${s.submitted}!`)
);

mount(view, document.getElementById("app"), store);
```

## How it works

### Virtual nodes

`h()` does not create any DOM. It returns a plain object `{ tag, attrs, children }`, and text is a plain string.
Your `view(state)` function returns a whole tree of these objects. They are cheap to create and easy to compare.

### Diffing (virtual DOM)

On each state change, `mount` calls `view(state)` again to get a **new** tree, and `patch()` compares it with the **old** tree node by node:

- the old node is missing: create the element and append it
- the new node is missing: remove the element
- it is the **same object** as before: skip it, nothing changed
- the text changed: update the text in place
- the tag (or `key`) changed: replace that node
- same tag: update only the attributes that changed (and only the changed `style` properties), then compare the children
  - children with a `key` are matched by key (moved, added, removed)
  - children without a key are matched by position

### Why only the changed parts update

Because of the diff, an element that did not change is left alone. It is not rebuilt.
This matters: if we rebuilt the whole page with `innerHTML` on each change, any `<input>` would be destroyed, so you would lose what you typed and the input would lose focus. With the diff, only the `<p>` text changes when a counter increases, and an input you are typing in stays the same element.

`value` and `checked` are set as **properties** (`el.value = ...`), not attributes. Otherwise inputs would not clear and checkboxes would not update. They are only written when they really differ, so re-rendering never disturbs an input you are typing in.

### Why events go through the framework

When you write `onClick: fn`, the framework calls `addEventListener` for you, **once** per element and event type. It stores your handler on the element (`el._events.click`). On the next render it only swaps the stored handler, so:

- you never get duplicate listeners after re-renders
- the handler always sees the latest state
- removing `onClick` from the attrs (or setting it to `null`) disables the handler

This is "inversion of control": you describe what should happen, and the framework decides when and how to wire it into the DOM.
