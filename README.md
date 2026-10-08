# mini-framework

**Hdo** is a small JavaScript framework made from scratch, with a TodoMVC app
built on top of it. It has no dependencies and no build step.

Features:

- **DOM abstraction**: describe elements as objects with `Hdo.h()`. Hdo
  updates only what changed (virtual DOM).
- **State management**: one global state with `Hdo.getState()` / `Hdo.setState()`.
- **Routing**: the URL (`#/route`) is kept in sync with `state.route`.
- **Event handling**: an `on` attribute on elements, and `Hdo.on()` for `window`/`document`.

The full documentation is in [`framework/README.md`](framework/README.md).

## Run it

From the root of this folder, open `index.html` in a browser. Or serve the
folder:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

| Page                               | What it shows                         |
| ---------------------------------- | ------------------------------------- |
| `index.html`                       | Links to everything                   |
| `todomvc/index.html`               | The TodoMVC app                       |
| `framework/examples/hello.html`    | Elements, nesting, attributes, events |
| `framework/examples/counter.html`  | State and keybindings                 |
| `framework/examples/pages.html`    | Routing                               |

## Folder structure

```
├── index.html             # home page (built with Hdo)
├── framework/
│   ├── hdo.js             # the whole framework
│   ├── README.md          # documentation
│   └── examples/          # one small page per feature
└── todomvc/
    ├── index.html
    ├── app.js             # TodoMVC written with Hdo
    └── css/index.css      # official TodoMVC stylesheet
```
