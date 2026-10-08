# Hdo — documentation

Hdo is a small JavaScript framework with four features:

| Feature              | API                                                     |
| -------------------- | ------------------------------------------------------- |
| DOM abstraction      | `Hdo.h()`, `Hdo.mount()`                                 |
| State management     | `Hdo.getState()`, `Hdo.setState()`, `Hdo.subscribe()`    |
| Routing              | `Hdo.router()`, `Hdo.navigate()`, `Hdo.match()`          |
| Event handling       | the `on` prop, `Hdo.on()`                                |

It is a single file with no dependencies: [`hdo.js`](hdo.js).

## Getting started

Add a container and the script to an HTML page, then mount a view:

```html
<div id="app"></div>

<script src="framework/hdo.js"></script>
<script>
  Hdo.mount(function () {
    return Hdo.h('h1', null, 'Hello world');
  }, document.getElementById('app'));
</script>
```

Open the page in a browser. You don't need a server or a build step.

Hdo is a **framework, not a library**. You don't update the page yourself.
You write a `view` function that describes the page, and Hdo calls it for
you every time the state changes:

```
user action  ->  your event handler  ->  Hdo.setState()  ->  Hdo calls view()  ->  DOM updated
```

---

## 1. Create an element

`Hdo.h(tag, attributes, ...children)` describes an element:

```js
Hdo.h('p', null, 'Hello');
```

It does **not** create a DOM node. It returns a plain object:

```js
{ tag: 'p', props: {}, children: [ { text: 'Hello' } ] }
```

Hdo creates the real element when you pass the object to `Hdo.mount()`
(or when it is a child of an element you mount).

- `tag` is any HTML tag name: `'div'`, `'button'`, `'input'` and so on.
- `attributes` is an object, or `null` if there are none.
- `children` are the arguments after the attributes (see below).

## 2. Add attributes to an element

Pass them in the second argument. Write each name exactly as you would
in HTML:

```js
Hdo.h('input', { type: 'text', placeholder: 'Insert Name', id: 'name' });
Hdo.h('a', { href: '#/about', class: 'link' }, 'About');
Hdo.h('label', { for: 'name' }, 'Name');
Hdo.h('div', { 'data-id': 42 });
```

Some values have special rules:

| Value                          | Result                                               |
| ------------------------------ | ---------------------------------------------------- |
| `true`                         | attribute present with no value (`disabled: true`)   |
| `false`, `null`, `undefined`   | attribute removed                                    |
| `value`, `checked`             | set on the input itself, so they always match the screen |
| `style: { color: 'red' }`      | inline styles (a plain string also works)            |
| `autofocus: true`              | the element is focused when Hdo creates it           |
| `key`                          | not an attribute; it identifies a list item (see 3)  |
| `on`                           | not an attribute; it holds the events (see 4)        |

## 3. Nest elements

Children come after the attributes. A child can be:

- a string or a number, which becomes text
- another `Hdo.h(...)`, which becomes a nested element
- an array of children
- `null`, `false` or `undefined`, which is skipped, so you can write conditions like `isOpen && Hdo.h(...)`

This HTML from the subject:

```html
<div class="nameSubm">
  <input type="text" placeholder="Insert Name" />
  <input type="submit" placeholder="Submit" />
</div>
```

is written like this:

```js
Hdo.h('div', { class: 'nameSubm' }, [
  Hdo.h('input', { type: 'text', placeholder: 'Insert Name' }),
  Hdo.h('input', { type: 'submit', placeholder: 'Submit' })
]);
```

and the call returns the same object as the subject's JSON:

```js
{
  tag: 'div',
  props: { class: 'nameSubm' },
  children: [
    { tag: 'input', props: { type: 'text', placeholder: 'Insert Name' }, children: [] },
    { tag: 'input', props: { type: 'submit', placeholder: 'Submit' }, children: [] }
  ]
}
```

**Lists.** When you build a list from an array, give each item a `key`.
Use something that never changes, such as an id:

```js
Hdo.h('ul', null, todos.map(function (todo) {
  return Hdo.h('li', { key: todo.id }, todo.title);
}));
```

The key lets Hdo know which `<li>` is which when items are added or removed.

## 4. Create an event

Put the handlers in the `on` attribute. Each key is an event name:
`click`, `input`, `keydown`, `dblclick`, `blur`, `change`, `submit`, `scroll`
or any other DOM event. Each value is the function to call:

```js
Hdo.h('button', {
  on: {
    click: function (event) { console.log('clicked'); }
  }
}, 'Click me');

Hdo.h('input', {
  on: {
    keydown: function (event) {
      if (event.key === 'Enter') console.log('value:', event.target.value);
    },
    blur: function () { console.log('left the input'); }
  }
});
```

The handler receives the normal browser `event`.

Some targets are not created with `h()`, such as `window` or `document`.
For those, use `Hdo.on(target, eventName, handler)`. It returns a function
that removes the handler:

```js
// keybinding on the whole page
var stop = Hdo.on(document, 'keydown', function (e) {
  if (e.key === 'Escape') console.log('escape pressed');
});

// scrolling
Hdo.on(window, 'scroll', function () { console.log(window.scrollY); });

stop(); // remove the keydown handler
```

## 5. State management

Hdo has **one global state object**, so every page and every function can
reach it.

```js
Hdo.setState({ count: 0, user: 'Ana' });   // set initial values

Hdo.getState().count;                      // read -> 0

Hdo.setState({ count: 1 });                // update -> { count: 1, user: 'Ana' }
```

`setState` **merges** the object you pass into the current state. Keys you
leave out are kept.

Treat the state as read-only. Always change it with `setState`, never like
this: `Hdo.getState().count = 5`. Hdo only knows the state changed when you
call `setState`.

### Mounting a view

`Hdo.mount(view, container)` calls `view()` and puts the result in
`container`. Hdo then **calls `view()` again after every `setState`**:

```js
Hdo.setState({ count: 0 });

function view() {
  return Hdo.h('div', null, [
    Hdo.h('p', null, 'Count: ' + Hdo.getState().count),
    Hdo.h('button', {
      on: { click: function () { Hdo.setState({ count: Hdo.getState().count + 1 }); } }
    }, '+1')
  ]);
}

Hdo.mount(view, document.getElementById('app'));
```

### Reacting to changes yourself

`Hdo.subscribe(fn)` calls `fn(state)` after every change. It returns a
function that stops the subscription:

```js
Hdo.subscribe(function (state) {
  localStorage.setItem('todos', JSON.stringify(state.todos));
});
```

## 6. Routing

The router keeps the URL and the state in sync. It uses the part of the URL
after `#`. For example, `index.html#/active` gives the route `'/active'`.

```js
Hdo.router();   // start once; it also reads the current URL
```

From then on, **`state.route` always holds the current route**. Clicking a
link, using the back/forward buttons or typing a URL all update it. The view
re-renders like it does for any other state change.

```js
function view() {
  var route = Hdo.getState().route;
  return Hdo.h('div', null, [
    Hdo.h('a', { href: '#/' }, 'Home'),
    Hdo.h('a', { href: '#/about' }, 'About'),
    route === '/about' ? Hdo.h('p', null, 'About page') : Hdo.h('p', null, 'Home page')
  ]);
}
```

To change the page from code, call `Hdo.navigate(route)`:

```js
Hdo.navigate('/about');
```

For routes with parameters, `Hdo.match(pattern, route)` returns the
parameters, or `null` if the route doesn't match:

```js
Hdo.match('/user/:id', '/user/7');   // -> { id: '7' }
Hdo.match('/user/:id', '/about');    // -> null
```

---

## Why things work the way they work

**Why describe elements with objects?** Objects are cheap to create and
easy to compare. Building a whole page as objects costs almost nothing.
Touching the real DOM is slow. So Hdo builds the objects first, then changes
only the real nodes that differ.

**How does Hdo update the page? (virtual DOM)** Hdo keeps the objects from
the last render. After `setState`, it calls `view()` again and compares the
new objects with the old ones:

- same tag: it keeps the element and updates only the changed attributes,
  events and text
- different tag: it replaces the element
- new child: it creates it; missing child: it removes it
- children with a `key` are matched by key, so list items keep their DOM
  nodes when the list changes

This is why an input you are typing in keeps its focus and text when
something else on the page changes.

**Why one global state?** The subject requires that "multiple pages may
need to interact with the same state". One store that anyone can read
(`getState`) and change (`setState`) gives that. Also, every change goes
through `setState`, so Hdo always knows when to redraw.

**Why the `on` attribute instead of `addEventListener`?** Events belong to
the element description, like its other attributes. Hdo adds one listener to
the element. When the event fires, that listener calls the function in the
current `on` object. When the view re-renders with a new function, Hdo
swaps the function instead of adding another listener. Handlers never pile
up and are never called twice. You also never have to remove them yourself.

**Why routing through the state?** The route is just another piece of
state. Your view reads `state.route` the same way it reads anything else.
A URL change triggers a re-render like any `setState` call. The hash (`#/…`)
is used because changing it never reloads the page. It also works when the
file is opened directly, without a server.

## Examples

- [`examples/hello.html`](examples/hello.html): elements, nesting, attributes, events
- [`examples/counter.html`](examples/counter.html): state, buttons, a keybinding
- [`examples/pages.html`](examples/pages.html): routing with a parameter
- [`../todomvc/`](../todomvc/): a complete TodoMVC app
