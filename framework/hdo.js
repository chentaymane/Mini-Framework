/*!
 * Hdo — a tiny, dependency-free framework.
 *
 * Features:
 *   - Virtual DOM abstraction (Hdo.h, Hdo.render, Hdo.mount)
 *   - State management (Hdo.createStore, global store, Hdo.getState/Hdo.setState)
 *   - Routing with clean URLs, synced with state (Hdo.createRouter, Hdo.navigate)
 *   - Custom event handling (the "on" prop, Hdo.listen, Hdo.emit)
 *
 * Load it with a plain <script> tag. All public API lives on window.Hdo.
 *
 * ============================================================
 * ARCHITECTURE — the framework is a stack of five layers.
 * Lower layers know nothing about the ones above them; every
 * layer only calls downward. This keeps the responsibilities
 * clean and the file easy to read top-to-bottom.
 *
 *   L0  core ......... type guards + vnode helpers
 *   L1  dom .......... virtual DOM: creation, diffing, patching
 *        └─ events ... the DOM binds user events here (downward)
 *   L2  store ........ observable state, shared everywhere
 *        └─ render ... L1 + L2, used as the app loop
 *   L3  router ....... URL services + the URL⇄state sync glue
 *   L4  api .......... the public Hdo facade (binds it all)
 * ============================================================
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* =========================================================
   * LAYER 0 — CORE
   *    Type guards and tiny helpers shared by every layer.
   *    No DOM access, no state, no side effects.
   * ========================================================= */

  function isElem(v) {
    return !!(v && typeof v === 'object' && typeof v.tag === 'string');
  }
  function isText(v) {
    return !!(v && typeof v === 'object' && typeof v.text === 'string');
  }
  function keyOf(v) {
    return isElem(v) ? v.key : undefined;
  }
  function hasKeys(list) {
    for (var i = 0; i < list.length; i++) {
      if (isElem(list[i]) && list[i].key != null) return true;
    }
    return false;
  }

  /* =========================================================
   * LAYER 0 — CORE: vnode factory
   *    h() turns a tag, a props object and children into a
   *    plain data structure — the "DOM as a big object".
   *    Children are normalized here: strings/numbers become
   *    text vnodes, arrays are flattened, and null/false are
   *    dropped (handy for conditional parts).
   * ========================================================= */

  function collectChildren(child, out) {
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) collectChildren(child[i], out);
    } else if (typeof child === 'string' || typeof child === 'number') {
      out.push({ text: String(child) });
    } else if (isElem(child)) {
      out.push(child);
    }
  }

  // h('div', { id: 'app' }, 'Hello ', h('strong', null, 'world'))
  // h('div', [ h('p'), h('p') ])
  // h('div', { class: 'card', children: [ h('p', null, 'nested children') ] })
  function h(tag, props) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (Array.isArray(props)) {
      rest = [props].concat(rest);
      props = {};
    }
    if (props == null) props = {};
    var children = [];
    for (var i = 0; i < rest.length; i++) collectChildren(rest[i], children);
    // children may also come in as a nested property of props; it is hoisted
    // into vnode.children and removed from the rendered attribute bag
    if (props.children != null) collectChildren(props.children, children);
    delete props.children;
    return {
      tag: tag,
      props: props,
      children: children,
      key: props.key != null ? props.key : undefined,
      elm: null
    };
  }

  /* =========================================================
   * LAYER 1 — VIRTUAL DOM
   *    Creation, diffing and patching of real DOM nodes, kept
   *    in sync with vnode trees. The diff walks both trees and
   *    touches only the nodes/attributes that actually changed.
   * ========================================================= */

  // Input-like properties that must be written to the node
  // itself (not via setAttribute).
  var ELEMENT_PROPS = {
    value: 1, checked: 1, selected: 1, disabled: 1, indeterminate: 1,
    autofocus: 1, muted: 1, multiple: 1, readOnly: 1, required: 1
  };

  function setDomProp(el, name, value) {
    if (value === null || value === undefined || value === false) {
      unsetDomProp(el, name);
      return;
    }
    if (name === 'class' || name === 'className') {
      el.className = value;
    } else if (name === 'style') {
      if (typeof value === 'string') el.style.cssText = value;
      else for (var k in value) el.style[k] = value[k];
    } else if (name === 'htmlFor') {
      el.setAttribute('for', value);
    } else if (ELEMENT_PROPS[name]) {
      el[name] = value === true || value === 'true' ? true : value;
      if (name === 'value') el.setAttribute('value', value);
    } else {
      el.setAttribute(name, value === true ? '' : value);
    }
  }

  function unsetDomProp(el, name) {
    if (name === 'class' || name === 'className') {
      el.removeAttribute('class');
    } else if (name === 'style') {
      el.removeAttribute('style');
    } else if (ELEMENT_PROPS[name]) {
      if (name === 'value') { el.value = ''; el.removeAttribute('value'); }
      else el[name] = false;
    } else {
      el.removeAttribute(name);
    }
  }

  // Diff the props object against the previous one and apply
  // only the changes to the live element.
  function applyProps(el, props, oldProps) {
    var p = props || {};
    var o = oldProps || {};
    var k;

    // events: drop old bindings that changed or disappeared
    if (o.on) {
      for (k in o.on) {
        if (!p.on || p.on[k] !== o.on[k]) unbindEvent(el, k);
      }
    }
    // events: (re)bind everything present in the new props
    if (p.on) {
      for (k in p.on) {
        if (typeof p.on[k] !== 'function') continue;
        if (o.on && o.on[k] === p.on[k]) continue; // unchanged
        bindEvent(el, k, p.on[k]);
      }
    }

    // non-event props
    for (k in p) {
      if (k === 'on' || k === 'key' || k === 'ref' || k === 'children') continue;
      if (o[k] !== p[k]) setDomProp(el, k, p[k]);
    }
    for (k in o) {
      if (k === 'on' || k === 'key' || k === 'ref' || k === 'children') continue;
      if (p[k] === undefined) unsetDomProp(el, k);
    }

    if (typeof p.ref === 'function') p.ref(el);
  }

  function createDom(vnode) {
    if (isText(vnode)) {
      var t = document.createTextNode(vnode.text);
      vnode.elm = t;
      return t;
    }
    var el = document.createElement(vnode.tag);
    vnode.elm = el;
    applyProps(el, vnode.props, null);
    for (var i = 0; i < vnode.children.length; i++) {
      el.appendChild(createDom(vnode.children[i]));
    }
    return el;
  }

  // Update one child in place.
  function patch(parent, oldVnode, newVnode) {
    if (newVnode == null) {
      if (oldVnode.elm && oldVnode.elm.parentNode === parent) {
        parent.removeChild(oldVnode.elm);
      }
      return;
    }
    if (isText(oldVnode) && isText(newVnode)) {
      if (oldVnode.text !== newVnode.text) oldVnode.elm.textContent = newVnode.text;
      newVnode.elm = oldVnode.elm;
      return;
    }
    if (isElem(oldVnode) && isElem(newVnode) && oldVnode.tag === newVnode.tag) {
      patchVnode(oldVnode, newVnode);
      return;
    }
    var elm = createDom(newVnode);
    if (oldVnode.elm && oldVnode.elm.parentNode === parent) {
      parent.replaceChild(elm, oldVnode.elm);
    } else {
      parent.appendChild(elm);
    }
  }

  function patchVnode(oldVnode, newVnode) {
    var elm = (newVnode.elm = oldVnode.elm);
    applyProps(elm, newVnode.props, oldVnode.props);
    patchChildren(elm, oldVnode.children, newVnode.children);
  }

  function patchChildren(parent, oldChildren, newChildren) {
    var i;

    if (!oldChildren.length) {
      for (i = 0; i < newChildren.length; i++) parent.appendChild(createDom(newChildren[i]));
      return;
    }
    if (!newChildren.length) {
      for (i = oldChildren.length - 1; i >= 0; i--) parent.removeChild(oldChildren[i].elm);
      return;
    }

    if (!hasKeys(oldChildren) && !hasKeys(newChildren)) {
      // position-based diff: patch the common prefix, remove the
      // old tail, append the new tail
      var common = Math.min(oldChildren.length, newChildren.length);
      for (i = 0; i < common; i++) patch(parent, oldChildren[i], newChildren[i]);
      for (i = oldChildren.length - 1; i >= common; i--) parent.removeChild(oldChildren[i].elm);
      for (i = common; i < newChildren.length; i++) parent.appendChild(createDom(newChildren[i]));
      return;
    }

    // keyed diff: reuse DOM nodes across reorders/insertions
    var oldMap = {};
    for (i = 0; i < oldChildren.length; i++) {
      var k = keyOf(oldChildren[i]);
      if (k != null) oldMap[k] = oldChildren[i];
    }
    for (var j = 0; j < newChildren.length; j++) {
      var nc = newChildren[j];
      var nk = keyOf(nc);
      var oc = nk != null ? oldMap[nk] : undefined;
      if (oc) {
        patch(parent, oc, nc);
        oldMap[nk] = null;
      } else {
        var elm = createDom(nc);
        var ref = parent.childNodes[j];
        if (ref) parent.insertBefore(elm, ref);
        else parent.appendChild(elm);
      }
    }
    // force the DOM to match the exact new order
    for (var n = 0; n < newChildren.length; n++) {
      var childElm = newChildren[n].elm;
      var want = parent.childNodes[n];
      if (childElm && want && childElm !== want) parent.insertBefore(childElm, want);
    }
    // strip stale nodes
    while (parent.childNodes.length > newChildren.length) {
      parent.removeChild(parent.childNodes[parent.childNodes.length - 1]);
    }
  }

  // Track the last vnode rendered into each container so the
  // next render can diff against it.
  var mounted = new WeakMap();

  // Hdo.render(vnode, container): mount once, patch afterwards.
  function render(vnode, container) {
    var prev = mounted.get(container);
    if (!prev) {
      container.innerHTML = '';
      container.appendChild(createDom(vnode));
    } else {
      patch(container, prev, vnode);
    }
    mounted.set(container, vnode);
    return vnode.elm;
  }

  /* ---- L1: game loop (requestAnimationFrame) ---- */

  var nextFrame = global.requestAnimationFrame
    ? function (cb) { return global.requestAnimationFrame(cb); }
    : function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
  var cancelFrame = global.cancelAnimationFrame
    ? function (id) { global.cancelAnimationFrame(id); }
    : clearTimeout;

  // Hdo.loop(update) -> { start, stop }
  // Calls update(dtSeconds, tSeconds) once per animation frame. Use it for
  // anything that must keep moving (games, animations) — pair it with
  // Hdo.batch() so a burst of setState still costs one render per frame.
  function loop(update) {
    if (typeof update !== 'function') throw new Error('Hdo.loop expects a function');
    var rafId = null;
    var running = true;
    var last = null;
    function frame(now) {
      if (!running) return;
      if (last == null) last = now;
      var dt = Math.min((now - last) / 1000, 0.1); // clamp huge gaps
      last = now;
      update(dt, now / 1000);
      rafId = nextFrame(frame);
    }
    rafId = nextFrame(frame);
    return {
      start: function () {
        if (running) return;
        running = true;
        last = null;
        rafId = nextFrame(frame);
      },
      stop: function () {
        running = false;
        if (rafId != null) cancelFrame(rafId);
        rafId = null;
      }
    };
  }

  /* =========================================================
   * LAYER 1 — VIRTUAL DOM: event bindings
   *    The framework's event layer. Developers never call
   *    addEventListener directly — they declare handlers with
   *    the "on" prop of h(). This module turns those props
   *    into real bindings for the DOM layer above.
   * ========================================================= */

  function bindEvent(el, type, handler) {
    var reg = el.__hdoEvents || (el.__hdoEvents = {});
    if (reg[type]) el.removeEventListener(type, reg[type]);
    var wrapped = function (e) { handler(e); };
    reg[type] = wrapped;
    el.addEventListener(type, wrapped);
  }

  function unbindEvent(el, type) {
    var reg = el.__hdoEvents;
    if (reg && reg[type]) {
      el.removeEventListener(type, reg[type]);
      delete reg[type];
    }
  }

  /* =========================================================
   * LAYER 2 — STATE
   *    A store is a shared, observable object. Any code (any
   *    page, any component) can read and change the same
   *    state; subscribers are notified on every change.
   * ========================================================= */

  /* ---- L2: store-wide batching ----
   * setState() notifies listeners as soon as it is called. Hdo.batch()
   * wraps a block of code and defers every notification inside it to a
   * single flush at the end — one render per frame even after a dozen
   * setState calls (e.g. a game tick updating many entities).
   */
  var batchQueue = [];
  var batching = false;

  function enqueueBatch(api, notify) {
    if (!batching) return false;
    for (var i = 0; i < batchQueue.length; i++) {
      if (batchQueue[i].api === api) return true; // already queued
    }
    batchQueue.push({ api: api, notify: notify });
    return true;
  }

  function flushBatch() {
    batching = false;
    var pending = batchQueue;
    batchQueue = [];
    for (var i = 0; i < pending.length; i++) pending[i].notify();
  }

  // Hdo.batch(fn): run fn, then notify each touched store exactly once.
  function batch(fn) {
    var outer = !batching;
    batching = true;
    if (outer) batchQueue = [];
    try {
      return fn();
    } finally {
      if (outer) flushBatch();
    }
  }

  function createStore(initial) {
    var state = initial || {};
    var listeners = [];

    function notify() {
      var snapshot = listeners.slice();
      for (var i = 0; i < snapshot.length; i++) snapshot[i](state);
    }

    var api = {
      getState: function () { return state; },
      setState: function (updater) {
        var next = typeof updater === 'function' ? updater(state) : updater;
        if (next == null) return state;
        state = Object.assign({}, state, next);
        if (!enqueueBatch(api, notify)) notify();
        return state;
      },
      subscribe: function (fn) {
        listeners.push(fn);
        var called = false;
        return function () {
          if (called) return;
          called = true;
          var i = listeners.indexOf(fn);
          if (i > -1) listeners.splice(i, 1);
        };
      },
      reset: function (next) {
        state = next || {};
        if (!enqueueBatch(api, notify)) notify();
        return state;
      }
    };
    return api;
  }

  /* =========================================================
   * LAYER 2 — STATE: the global store
   *    One shared default store so state is reachable from
   *    everywhere. mount() re-renders the given view after
   *    every change — an application of L1 + L2.
   * ========================================================= */

  var store = createStore({ route: '/', params: {}, notFound: false });

  function getState() { return store.getState(); }
  function setState(updater) { return store.setState(updater); }
  function subscribe(fn) { return store.subscribe(fn); }

  // The framework calls you: mount() renders view() right now and
  // re-renders it automatically after every setState(). Pass
  // Hdo.mount(view, el, { select: fn }) to only re-render when the
  // slice returned by fn changes — perfect for a HUD that watches one
  // small part of the state while a board re-renders every frame.
  function shallowEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    var ak = Object.keys(a);
    var bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (var i = 0; i < ak.length; i++) {
      if (a[ak[i]] !== b[ak[i]]) return false;
    }
    return true;
  }

  function mount(view, container, options) {
    if (typeof view !== 'function') throw new Error('Hdo.mount expects a function that returns a vnode');
    options = options || {};
    render(view(), container);
    var lastSelected = typeof options.select === 'function' ? options.select(getState()) : undefined;
    return subscribe(function (state) {
      if (typeof options.select === 'function') {
        var next = options.select(state);
        if (shallowEqual(lastSelected, next)) return;
        lastSelected = next;
      }
      render(view(), container);
    });
  }

  /* =========================================================
   * LAYER 3 — ROUTER: URL services
   *    Path helpers + pattern matching. Pure functions: no
   *    state, no side effects.
   * ========================================================= */

  function normalizePath(p) {
    if (!p) p = '/';
    if (p.charAt(0) !== '/') p = '/' + p;
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    return p;
  }

  // '/user/42'    matches '/user/:id'  -> { id: '42' }
  function segmentize(p) {
    return p.split('/').filter(Boolean);
  }

  function matchPattern(pattern, path) {
    if (pattern === path) return { params: {} };
    var pa = segmentize(pattern);
    var pt = segmentize(path);
    if (pa.length !== pt.length) return null;
    var params = {};
    for (var i = 0; i < pa.length; i++) {
      if (pa[i].charAt(0) === ':') params[pa[i].slice(1)] = decodeURIComponent(pt[i]);
      else if (pa[i] !== pt[i]) return null;
    }
    return { params: params };
  }

  /* =========================================================
   * LAYER 3 — ROUTER: state sync glue
   *    Keeps the URL and the store in sync. Every navigation
   *    (link click, back/forward, Hdo.navigate) writes
   *    { route, params } into the global store.
   * ========================================================= */

  var router = null;

  function createRouter(options) {
    options = options || {};
    var routes = options.routes || {};
    var base = String(options.base || '');
    while (base.length > 1 && base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
    if (base === '') base = '';

    // browsers block history.pushState on file:// — fall back to hash URLs
    var useHash = location.protocol === 'file:';

    function stripBase(raw) {
      var p = raw || '/';
      if (base && p.indexOf(base) === 0) p = p.slice(base.length);
      if (p === '') p = '/';
      return p;
    }

    function joinBase(path) {
      var p = normalizePath(path);
      if (!base || base === '/') return p;
      return base + p;
    }

    function currentRaw() {
      if (useHash) return (location.hash.replace(/^#/, '') || '/');
      return decodeURIComponent(location.pathname || '/');
    }

    function match(raw) {
      var path = normalizePath(stripBase(raw));
      var keys = Object.keys(routes);
      for (var i = 0; i < keys.length; i++) {
        var m = matchPattern(normalizePath(keys[i]), path);
        if (m) return { path: path, route: keys[i], params: m.params, notFound: false };
      }
      return { path: path, route: path, params: {}, notFound: keys.length > 0 };
    }

    function dispatch() {
      var m = match(currentRaw());
      setState({
        route: normalizePath(m.route),
        params: m.params,
        notFound: m.notFound,
        href: currentRaw()
      });
      return m;
    }

    function navigate(path) {
      var p = normalizePath(String(path || '/'));
      var url = joinBase(p);
      if (useHash) {
        location.hash = p;
      } else {
        try { history.pushState(null, '', url); }
        catch (err) { location.hash = p; }
      }
      return dispatch();
    }

    function onDocumentClick(e) {
      var a = e.target;
      while (a && a.nodeType === 1 && !(a.tagName === 'A' && a.hasAttribute('data-link'))) {
        a = a.parentNode;
      }
      if (!a || a.nodeType !== 1) return;
      var href = a.getAttribute('href') || '';
      e.preventDefault();
      if (href.charAt(0) === '/') {
        navigate(stripBase(decodeURIComponent(href)));
      } else {
        navigate(href);
      }
    }

    function onPop() {
      dispatch();
    }

    document.addEventListener('click', onDocumentClick);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);

    router = {
      routes: routes,
      base: base,
      link: joinBase,
      match: match,
      navigate: navigate,
      dispatch: dispatch,
      useHash: useHash,
      stop: function () {
        document.removeEventListener('click', onDocumentClick);
        window.removeEventListener('popstate', onPop);
        window.removeEventListener('hashchange', onPop);
      }
    };

    // read the current URL once, right away
    dispatch();
    return router;
  }

  /* =========================================================
   * LAYER 4 — API: imperative events
   *    Hdo.listen attaches a handler and returns an
   *    "unlisten" function. Hdo.emit fires bubbling custom
   *    events so components can talk without a shared ref.
   * ========================================================= */

  // Hdo.listen(el, 'keydown', fn) -> unlisten()
  function listen(el, type, handler, options) {
    if (!el || !el.addEventListener) throw new Error('Hdo.listen expects a DOM element');
    el.addEventListener(type, handler, options);
    return function () { el.removeEventListener(type, handler, options); };
  }

  // Hdo.emit(el, 'todo:added', { id: 42 }) fires a CustomEvent
  // named 'todo:added' on el and its ancestors (bubbles).
  function emit(target, type, detail) {
    var event = new CustomEvent(type, { detail: detail, bubbles: true, cancelable: true });
    return target.dispatchEvent(event);
  }

  /* =========================================================
   * LAYER 4 — API: networking bridge
   *    Hdo.connect(url) wraps a WebSocket and turns raw frames
   *    into typed JSON messages ({ type, payload }). The app
   *    pipes messages into the store with Hdo.batch() and the
   *    store drives the DOM — multiplayer without a framework
   *    upgrade.
   * ========================================================= */

  function connect(url) {
    if (typeof WebSocket === 'undefined') throw new Error('Hdo.connect requires WebSocket support');
    var ws = url instanceof WebSocket ? url : new WebSocket(url);
    var handlers = {};
    var opens = [];
    var closes = [];

    function fire(list, arg) {
      for (var i = 0; i < list.length; i++) list[i](arg);
    }
    function remove(list, fn) {
      var i = list.indexOf(fn);
      if (i > -1) list.splice(i, 1);
    }

    ws.addEventListener('open', function () { fire(opens, ws); });
    ws.addEventListener('close', function (e) { fire(closes, e); });
    ws.addEventListener('message', function (e) {
      var msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg && msg.type && handlers[msg.type]) fire(handlers[msg.type], msg.payload, msg);
    });

    return {
      send: function (type, payload) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: type, payload: payload }));
      },
      on: function (type, fn) {
        (handlers[type] = handlers[type] || []).push(fn);
        return function () { remove(handlers[type], fn); };
      },
      onOpen: function (fn) { opens.push(fn); return function () { remove(opens, fn); }; },
      onClose: function (fn) { closes.push(fn); return function () { remove(closes, fn); }; },
      close: function () { ws.close(); },
      ready: function () { return ws.readyState === 1; }
    };
  }

  /* =========================================================
   * LAYER 4 — API: the public facade
   *    The single object every page sees. Each method simply
   *    forwards to the layer that implements it.
   * ========================================================= */

  var Hdo = {
    version: VERSION,
    // --- virtual DOM (layer 1) ---
    h: h,
    render: render,
    mount: mount,
    loop: loop,
    // --- state (layer 2) ---
    createStore: createStore,
    store: store,
    getState: getState,
    setState: setState,
    subscribe: subscribe,
    batch: batch,
    // --- routing (layer 3) ---
    createRouter: createRouter,
    navigate: function (path) {
      if (!router) createRouter({});
      return router.navigate(path);
    },
    link: function (path) {
      if (!router) createRouter({});
      return router.link(path);
    },
    // --- imperative events (layer 4) ---
    listen: listen,
    on: listen,
    emit: emit,
    connect: connect
  };

  global.Hdo = Hdo;
})(typeof window !== 'undefined' ? window : globalThis);