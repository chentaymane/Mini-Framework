# Hdo

A tiny, dependency-free JavaScript framework for building web apps.

Hdo gives you four things, and nothing more:

| Feature              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| **Virtual DOM**      | Describe your UI as data (`h()`), not as strings or DOM calls.     |
| **State management** | One shared store that any part of the app can read and update.     |
| **Routing**          | Clean URLs that stay in sync with the store.                       |
| **Event handling**   | A custom event API — you never touch `addEventListener` yourself.  |
| **Loops & batching** | A `requestAnimationFrame` loop and a batched `setState` path for real-time, frame-driven apps. |
| **Networking**       | A tiny WebSocket bridge (`connect`) that turns a host's messages into state. |

It is a **framework**, not a library: you don't drive it, it drives *you*.
You write plain functions that describe what your screen should look like,
and Hdo calls those functions every time your state changes.

## Quick start

Serve the project root over HTTP (the router uses clean URLs, which browsers
only allow over a server):

```sh
npx serve .        # or: python -m http.server 8000
```

Then include the framework and mount an app:

```html
<script src="framework/hdo.js"></script>
<script>
  Hdo.mount(function () {
    return Hdo.h('h1', null, 'Hello, Hdo');
  }, document.getElementById('app'));
</script>
```

Open the page: `Hdo.mount` renders your function's result immediately, and
re-renders it automatically after every state change. That's the whole idea:

```
user event ─▶ Hdo.setState(...) ─▶ store notifies Hdo.mount ─▶ your view() runs
```

The **view is a pure function** of the state. You never write "update this
`div`" — you describe the whole screen, and Hdo figures out the smallest set
of DOM changes needed.

---

## 1. Creating an element

Use `Hdo.h(tag, props, ...children)` — pronounced *hyperscript*. It returns a
plain JS object (JSON-equivalent), not a real DOM node:

```js
Hdo.h('button', { class: 'btn' }, 'Click me');
// → { tag: 'button', props: { class: 'btn' }, children: [ { text: 'Click me' } ], key: undefined, elm: null }
```

Because the output is plain data, an HTML document and its Hdo description
are two spellings of the same thing:

```html
<div class="nameSubm">
  <input type="text" placeholder="Insert Name" />
  <input type="submit" value="Submit" />
</div>
```

```js
Hdo.h('div', { class: 'nameSubm' }, [
  Hdo.h('input', { type: 'text', placeholder: 'Insert Name' }),
  Hdo.h('input', { type: 'submit', value: 'Submit' })
]);
```

Children can be:

- **strings / numbers** — become text nodes,
- **other vnodes** — nested elements,
- **arrays** — flattened automatically,
- **`null` / `false` / `undefined`** — skipped (handy for conditional parts).

They are passed as trailing arguments. If you prefer, you can also put them in
the props object as a `children` key — the value is hoisted into the vnode's
nested `children` array (appended after any positional children) and is never
applied to the element as an attribute:

```js
Hdo.h('div', { class: 'card', children: [Hdo.h('p', null, 'nested')] });
// same tree as: Hdo.h('div', { class: 'card' }, Hdo.h('p', null, 'nested'))
```

> Why this matters: elements described as data can be built *before* they hit
> the DOM, compared cheaply, and re-rendered without ever destroying things
> that didn't change. See [*Why it works the way it does*](#7-why-it-works-the-way-it-does).

## 2. Nesting elements

Nesting is just passing children. The DOM tree mirrors the argument tree:

```js
Hdo.h('div', { class: 'card' }, [
  Hdo.h('h2', null, 'Profile'),
  Hdo.h('p', null, [
    'Hi, my name is ',
    Hdo.h('strong', null, 'Hdo'),
    '.'
  ])
]);
```

renders as

```html
<div class="card">
  <h2>Profile</h2>
  <p>Hi, my name is <strong>Hdo</strong>.</p>
</div>
```

**Lists** get a special helper: a `key` prop. When the framework re-renders
a list, it uses keys to tell two items apart, so it can move/keep an
existing row (and its events and focus) instead of rebuilding it:

```js
todos.map(function (t) {
  return Hdo.h('li', { key: t.id }, t.title);
});
```

Leave `key` off for static lists; it's only needed when items are added,
removed, or reordered.

## 3. Adding attributes

Any prop except `key`, `on`, and `ref` is written to the real element:

| Prop                          | Becomes                                  |
| ----------------------------- | ---------------------------------------- |
| `class` / `className`         | the `class` attribute                    |
| `style: 'color:red'` \| `style: { color: 'red' }` | inline styles           |
| `htmlFor`                     | the `for` attribute (labels)             |
| `value`, `checked`, `selected`, `disabled`, `autofocus`, … | the DOM *property* (correct for inputs/checkboxes) |
| `hidden` and other boolean attributes | set/removed as attributes |
| `data-*`, `aria-*`, anything else | a plain attribute                    |

Changing a prop between renders updates the DOM in place (diffing, not
rebuilding):

```js
Hdo.h('input', { type: 'checkbox', checked: todo.completed });
```

A `ref` prop is a function called with the real element once it exists —
useful for focus:

```js
Hdo.h('input', { ref: function (el) { el.focus(); } });
```

## 4. Events

Hdo has its own event layer. **You never call `addEventListener`.** (The
framework does it internally, on your behalf.)

### Declarative: the `on` prop

Handlers are declared on the element, next to its attributes:

```js
Hdo.h('button', {
  on: {
    click: function () { console.log('clicked'); },
    mouseenter: function () { console.log('hovered'); }
  }
}, 'Press me');
```

Any DOM event type works: `click`, `change`, `keydown`, `dblclick`, `input`,
`scroll`, `submit`, …

### Imperative: `Hdo.listen`

For events on things that aren't rendered as vnodes (the `window`, the
`document`, …), use the command form. It returns an "unlisten" function:

```js
var stop = Hdo.listen(document, 'keydown', function (e) {
  if (e.key === 'Escape') Hdo.setState({ menuOpen: false });
});
// later: stop();
```

### Custom events: `Hdo.emit`

You can fire your own bubbling events and listen to them with the same API:

```js
// component A
Hdo.emit(document, 'todo:added', { id: 1 });

// component B
Hdo.listen(document, 'todo:added', function (e) {
  console.log('new todo:', e.detail.id);
});
```

### Event handlers and state — the important rule

Your handlers should **not** try to update the DOM. They read/write state:

```js
{ click: function () { Hdo.setState({ count: Hdo.getState().count + 1 }); } }
```

Hdo then re-renders automatically. Handling the state, not the DOM, is the
whole model.

## 5. State management

State is a plain object held by a **store** — one shared, observable source
of truth. Any page, component, or callback can read and change it; anything
that renders from it reacts.

### The store

```js
var store = Hdo.createStore({ count: 0 });

store.getState();                       // -> { count: 0 }
store.setState({ count: 1 });           // shallow-merges + notifies listeners
store.setState(function (prev) {        // or compute from previous
  return { count: prev.count + 1 };
});
store.subscribe(function (state) { ... }); // returns an unsubscribe function
```

### The global store

Since "multiple pages may need the same state," a default store exists and
is reachable *everywhere* through tiny globals:

```js
Hdo.setState({ route: '/', user: null });   // write
Hdo.getState();                             // read
Hdo.subscribe(fn);                          // listen
```

`Hdo.mount` subscribes for you: it re-renders the view after every
`Hdo.setState`, so your screen is always a projection of the store.

### A complete example

```js
Hdo.setState({ count: 0 });

Hdo.mount(function () {
  var s = Hdo.getState();
  return Hdo.h('div', null, [
    Hdo.h('span', null, 'Count: ' + s.count),
    Hdo.h('button', {
      on: { click: function () { Hdo.setState({ count: s.count + 1 }); } }
    }, '+1')
  ]);
}, document.getElementById('app'));
```

Click the button → `setState` → the store notifies the mount subscription →
`view()` runs again → Hdo diffs the old tree vs the new tree → only the
text "Count: N" changes in the real DOM.

## 6. Rendering & the virtual DOM

- `Hdo.render(vnode, container)` — mount a vnode, then patch on later calls.
- `Hdo.mount(view, container)` — like `render`, but takes a *function* and
  re-renders it automatically on every state change. **This is what you
  normally use.**

```js
// one-shot:
Hdo.render(Hdo.h('p', null, 'hi'), el);

// reactive:
Hdo.mount(function () { return Hdo.h('p', null, Hdo.getState().msg); }, el);
```

### Diffing, in one paragraph

On each render Hdo compares the new tree with the previous one, walking both
trees top-down:

1. Different element type or tag → replace the node.
2. Same tag → update only the changed attributes/properties, then recurse
   into children.
3. Text nodes → update only if the text changed.
4. Lists with `key`s → reuse/match rows across reorders and insertions.

The result: the browser's DOM is touched exactly where it must be — nothing
else is destroyed, so typed input isn't lost and page flicker is avoided.

## 7. Routing

Routing in Hdo is just **URL ⇄ state sync**. The router watches the URL, and
on every change writes the result into the store:

```
URL changes ─▶ Hdo writes { route, params } into state ─▶ view re-renders
```

### Setting it up

```js
Hdo.createRouter({
  base: '/myapp',                       // where the app is served from
  routes: {
    '/':            'home',             // value is arbitrary - a label
    '/user/:id':    'user',             // :param segments are supported
    '/contact':     'contact'
  }
});
```

Actions on the page use the same store — nothing special needed:

```js
Hdo.navigate('/user/42');             // pushState + setState({ route, params })
Hdo.getState().route                  // -> '/user/:id'
Hdo.getState().params.id              // -> '42'
```

### Links

Two ways to let users change the URL:

```html
<a data-link href="/myapp/contact">Contact</a>
```

Hdo intercepts `data-link` anchors, so the page never reloads even though the
link has a real clean URL. (Real `href` + programmatic `navigate` work too.)

```js
Hdo.navigate('/contact');
```

### Handling routes

Since routing is just state, you pick what to render from `state.route` — a
single `switch` in one view function:

```js
function view() {
  var s = Hdo.getState();
  if (s.notFound) return Hdo.h('h2', null, '404 — not found');
  if (s.route === '/user/:id') return Hdo.h('h2', null, 'User ' + s.params.id);
  return Hdo.h('h2', null, 'Home');
}

Hdo.mount(view, document.getElementById('app'));
```

### No server? It still kind of works

If you open `index.html` straight from disk (`file://`), browsers block
`history.pushState`. Hdo detects this and falls back to hash URLs
(`#/active`) automatically — the same URLs, just hash-prefixed.

## 8. Putting it together: the full picture

```
            ┌────────────────────────────┐
            │        Hdo store           │  the single source of truth
            │ { route, todos, ui, ... }  │
            └──────┬──────────┬──────────┘
                   │ getState │ setState
        ┌──────────▼──┐   ┌───▼───────────┐
        │  your view()│   │ your handlers │
        │ (returns    │   │ (events from  │
        │  vnode tree)│   │  on / listen) │
        └──────────┬──┘   └───▲───────────┘
                   │          │
            Hdo.mount          │
            (subscription)     │
                   │  user events /
                   │  router (URL) 🠚 navigate / links
                   └──────────┘
```

1. User acts (clicks a link, presses a key, checks a box).
2. The handler calls `Hdo.setState` or `Hdo.navigate`.
3. The store notifies every subscriber — including `Hdo.mount`.
4. Your `view()` runs, returning a fresh vnode tree.
5. Hdo diffs it against the old tree and patches only the changed parts.

You never order the framework around. You describe the screen; it keeps the
screen true.

---

## API reference

| Function                                   | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `Hdo.h(tag, props?, ...children)`          | Create a vnode (element / text / nesting / attrs)  |
| `Hdo.render(vnode, container)`             | Mount, then diff-patch on later calls              |
| `Hdo.mount(viewFn, container, opts?)`      | Render `viewFn()` on every state change; `opts.select` limits which state changes re-render |
| `Hdo.loop(update)`                         | Start a `requestAnimationFrame` loop; returns `{ start, stop }` |
| `Hdo.batch(fn)`                            | Run `fn` and coalesce all its `setState` calls into one notification |
| `Hdo.createStore(initial)`                 | New store (`getState`/`setState`/`subscribe`/`reset`) |
| `Hdo.store`                                | The global store object                             |
| `Hdo.getState()` / `Hdo.setState(p)` / `Hdo.subscribe(fn)` | Global store helpers          |
| `Hdo.createRouter({ base, routes })`       | Start routing; returns router obj                  |
| `Hdo.navigate(path)`                       | Change the URL and sync the store                  |
| `Hdo.link(path)`                           | Full clean-URL for a route path (`/myapp/contact`) |
| `Hdo.connect(url)`                         | WebSocket bridge: `send`, `on`, `onOpen`, `onClose`, `close`, `ready` |
| `Hdo.listen(el, type, handler)`            | Imperative events (returns unlisten); `Hdo.on` is an alias |
| `Hdo.emit(el, type, detail)`               | Fire a bubbling custom event                       |
| `Hdo.version`                              | Framework version string                           |

**Special vnode props:** `key` (list identity), `on` (event map), `ref`
(function called with the real element).

## 8. Architecture: the framework as a stack of layers

`hdo.js` is a single file, but it is organised as five layers. Every layer
only calls downward — lower layers know nothing about the ones above, which
keeps responsibilities clean and makes the file readable top-to-bottom:

```
L4  api ........ the public Hdo facade: one object, two groups
│   │             (imperative events, the export object)
├─ L3  router ... URL-services (path helpers, :param matching) + the
│   │             glue that writes { route, params } into the store
├─ L2  store .... observable state + the global store; mount() = render + subscribe
├─ L1  dom ...... virtual DOM (create / diff / patch) +
│   │             the event-bindings module it uses
└─ L0  core ..... type guards (elem/text/key), the h() vnode factory
```

Each real-world feature lives in exactly one place:

- **State** → L2 (`createStore`, `store`, `mount`).
- **DOM abstraction** → L1 + L0 (`h`, `render`, diffing, patching).
- **Routing** → L3 (URL services + state sync).
- **Events** → declared handlers are bound in L1's events module; the
  imperative API (`Hdo.listen` / `Hdo.emit`) sits in L4.

Read the section banner at the top of `framework/hdo.js` for the full map.

## 9. Why it works the way it does

- **The DOM is built from data.** Describing elements as plain objects keeps
  the DOM a *projection* of your state instead of an imperative mess. It's
  easier to reason about ("this screen equals this data"), and it makes
  diffing possible.
- **Diffing, not rebuilding.** Comparing the previous element tree with the
  next one lets Hdo do the *minimum* DOM work: tweak a text node, flip a
  class, rebind an event. That's what makes "re-render the whole app" cheap
  enough to do on every keystroke-driven state change.
- **Keys keep identity.** Without a stable identity, moving an item in a list
  would look like "delete + recreate" (losing focus/state). `key` tells the
  diff "these are the same todo, just in a new place," so DOM nodes are
  reused and only moved.
- **One store, everywhere.** State scattered across components breaks as an
  app grows — two pages can't agree. A single observable store (with tiny
  globals) is the simplest way to make state reachable from any code, which
  is also why the router treats the URL as *another input to the store*.
- **The URL is state.** `#/active` vs `/active` are just different spellings
  of "show active todos". Keeping the two synced (pushState writes the store,
  navigation reads it) means back/forward buttons, link sharing, and the
  render pipeline all use the same path.
- **Events are declared, not wired.** Handlers on the element (the `on` prop)
  read naturally, survive re-renders, and — because they centralise changes
  behind `setState` — guarantee the UI never drifts from the state.

## 10. Project layout

```
mini-framework/
├── framework/
│   ├── hdo.js                 ← the whole framework
│   ├── README.md              ← this document
│   └── examples/
│       ├── hello.html         ← elements, nesting, attributes, events
│       ├── counter.html       ← state + events
│       ├── pages.html         ← clean-URL routing
│       └── loop.html          ← loop + batching + selective mounts
├── server/                    ← the Bomberman host (Node + WebSocket)
│   ├── index.js               ← ws server, rooms, 30 Hz broadcast loop
│   ├── game.js                ← the game simulation
│   └── levels.js              ← map generation
├── game/                      ← the playable client (no build step)
│   ├── index.html
│   ├── css/app.css
│   └── js/{constants,input,net,board,app}.js
└── todomvc/
    ├── index.html             ← TodoMVC
    ├── css/app.css
    └── app.js                 ← built entirely with Hdo
```

## 11. Loops — frame-driven rendering

For anything that animates in real time you can't wait for a state change to
re-render. `Hdo.loop` gives you a `requestAnimationFrame` callback that runs
every frame, with a passed delta time (seconds, clamped so a tab switch
doesn't cause a huge leap):

```js
var ball = { x: 0, y: 0 };
var loop = Hdo.loop(function (dt) {
  ball.x += 60 * dt;                    // 60 px per second, frame-rate independent
  if (ball.x > 400) ball.x = 0;
  Hdo.setState({ ball: { x: ball.x, y: ball.y } });
});
loop.stop();                            // when you don't need it any more
loop.start();                           // restart at any time
```

`start()` and `stop()` are idempotent. Independent deduped loops share a
single underlying rAF handler. See `framework/examples/loop.html`.

## 12. Batching — many updates, one render

`setState` notifies subscribers synchronously by default (backwards
compatible). When one logical update touches the store several times, that
means several re-renders. Wrap the update in `Hdo.batch` and every `setState`
inside it is collected and flushed once when the callback returns:

```js
Hdo.batch(function () {
  Hdo.setState({ connected: true });
  Hdo.setState({ phase: 'lobby' });
  Hdo.setState({ roster: [] });
});                                   // subscribers notified exactly once
```

It nests safely and notifications are always flushed synchronously at the end
of the outer batch.

## 13. Selective mounts — `select`

A mount can subscribe to *part* of the state instead of the whole store. Pass
a `select(state)` function; the view re-renders only when the selected slice
changes. The view receives the slice as its argument:

```js
Hdo.mount(function (s) {
  return Hdo.h('div', null, 'Phase: ' + s.phase);
}, document.getElementById('hud'), {
  select: function (state) { return { phase: state.phase, phaseTick: state.phaseTimer }; }
});
```

The old behaviour (every state change re-renders) is the default, so calling
`Hdo.mount(view, el)` still works exactly as before.

## 14. Networking — `Hdo.connect`

A tiny WebSocket bridge that fits the same "messages become state" mental
model. Create a connection with the host URL and use message events instead
of writing transport code:

```js
var conn = Hdo.connect('ws://127.0.0.1:8080');
conn.on('joined', function (p) { Hdo.setState({ playerId: p.playerId }); });
conn.on('players', function (p) { Hdo.setState({ roster: p.roster }); });
conn.send('input', { right: true });
conn.close();
```

API:

| Method / property | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `conn.on(type, fn)`  | Register a handler for `type`; returns an unsubscribe fn |
| `conn.onOpen(fn)` / `conn.onClose(fn)` | Connection/lifecycle callbacks (return unsubscribers) |
| `conn.send(type, payload)` | Send a `{ type, payload }` message                 |
| `conn.ready()`     | Whether the socket is open                            |
| `conn.close()`     | Close the connection                                  |

`Hdo.connect` is transport-only — how you respond to messages is still
`setState` + `mount`.

## 15. The multiplayer game (built on all of it)

`game/` is a complete 4-player Bomberman where the whole board is drawn as
`<div>` tiles through Hdo's virtual DOM — no `<canvas>`. It uses every
extension in this chapter:

- **`Hdo.loop`** drives the render loop. Movement is grid-locked: one
  direction-key press = exactly one tile, so each 30 Hz snapshot (integer cell
  coordinates) is drawn verbatim — no interpolation needed.
- **`Hdo.batch`** groups everything the network handlers set (joined, phase,
  roster, …) into single renders.
- **`select`** keeps the HUD + overlays subscribing only to the small slice
  they need, while the board keeps its own imperative, keyed tile grid.
- **`Hdo.connect`** is the whole client network layer on top of the Node
  host in `server/` (WebSocket, rooms of up to 4, an authoritative 30 Hz
  simulation of movement, bombs, fire, power-ups and round scoring).

Host: `npm run server` (or `PORT=9000 npm run server`). Serve the files:
`npm run serve`, then join from `/game/` in up to four browser tabs.

*Hdo was built from scratch as part of the mini-framework project. It uses no
libraries or frameworks.*