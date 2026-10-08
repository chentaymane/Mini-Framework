# mini-framework

A from-scratch JavaScript framework — **Hdo** — with a TodoMVC app and a
**4-player multiplayer Bomberman** built on it. No libraries, no bundlers, no
build step: just a script tag and plain JS.

## Features

- **Virtual DOM** — elements are plain data (`Hdo.h`), diffed and patched.
- **State management** — one shared observable store.
- **Routing** — clean URLs kept in sync with the store.
- **Event handling** — a custom API; no `addEventListener` in your code.
- **Loops & batching** — a rAF loop and a coalesced `setState` path for
  frame-driven, real-time apps.
- **Networking** — a WebSocket bridge (`Hdo.connect`) plus a complete
  authoritative multiplayer game host in Node.

See [`framework/README.md`](framework/README.md) for the full documentation,
with examples for creating elements, nesting, attributes, events, state,
routing, loops, batching, selective mounts, and networking.

## Running the app

The router uses clean URLs, which browsers only allow over HTTP. From the
project root:

```sh
npm run serve      # uses npx serve
# or
python -m http.server 8000        # then open http://localhost:8000/
# or any static server
```

Then open `http://localhost:3000/` (or `:8000`):

| URL                                    | What it is                                   |
| -------------------------------------- | -------------------------------------------- |
| `/`                                    | Landing page (itself built with Hdo)         |
| `/todomvc/`                            | The TodoMVC app                              |
| `/game/`                               | Bomberman client (needs the host, below)     |
| `/framework/examples/hello.html`       | Elements / nesting / attributes / events     |
| `/framework/examples/counter.html`     | State management + events                    |
| `/framework/examples/pages.html`       | Clean-URL routing                            |
| `/framework/examples/loop.html`        | Loops + batching + selective mounts          |

> Opening `index.html` directly from disk also works in a degraded way: Hdo
> detects `file://` and falls back to hash URLs automatically.

## Playing the multiplayer game

The host is an authoritative Node server: it simulates movement, bombs, fire,
power-ups and scoring, and broadcasts snapshots to every client 30 times per
second.

```sh
npm run server        # WebSocket host on ws://127.0.0.1:8080 (PORT env to change)
```

Then open `/game/` in up to **four** browser tabs, give a name, and pick the
same room in each. Anyone in the room presses **Start** and a countdown runs;
last player standing wins the round and scores a point.

Movement is classic grid-locked Bomberman: **one direction-key press moves you
exactly one tile** (holding a key does not auto-repeat — tap to walk). You
cannot step onto a wall, a block, a bomb, or a tile another player stands on.

Controls (one profile per player):

| Player | Move                    | Drop bomb |
| ------ | ----------------------- | --------- |
| P1     | WASD                    | Space     |
| P2     | Arrow keys              | Enter     |
| P3     | IJKL                    | Shift     |
| P4     | Numpad 8 / 5 / 4 / 6    | Numpad 0  |

The whole board is drawn as DOM tiles through Hdo's virtual DOM (no canvas);
the client renders each 30 Hz snapshot verbatim on a `requestAnimationFrame`
loop (`Hdo.loop`), and the server validates everything (only the host runs
the simulation).

## Tests

```sh
npm test      # framework unit tests + server tests + end-to-end game tests
```

The end-to-end suite boots a real server and drives up to four jsdom
"browser" clients through join → countdown → play → round over, exercising
the framework's loop, batching, selective mounts, and networking for real.

## Folder structure

```
├── index.html            # landing page (built with Hdo)
├── package.json          # scripts: serve / server / test
├── framework/
│   ├── hdo.js            # the entire framework
│   ├── README.md         # framework documentation
│   └── examples/         # one file per feature
├── server/               # multiplayer host (Node + WebSocket, no HTTP)
│   ├── index.js          # ws server, rooms, 30 Hz broadcast loop
│   ├── game.js           # authoritative game simulation
│   └── levels.js         # seeded map generation
├── game/                 # Bomberman client (classic script tags)
│   ├── index.html
│   ├── css/app.css
│   └── js/               # constants / input / net / board / app
├── todomvc/
│   ├── index.html
│   ├── css/app.css       # classic TodoMVC look
│   └── app.js            # TodoMVC built entirely with Hdo
└── tests/
    ├── run.js            # test runner (spawns the three suites)
    ├── framework.test.js # loops, batching, select, connect
    ├── server.test.js    # level + simulation unit tests
    └── game.test.js      # end-to-end multiplayer integration
```