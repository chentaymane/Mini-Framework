/*
 * Hdo — a tiny framework.
 *
 *   1. DOM abstraction : Hdo.h()  describes elements as plain objects
 *                        Hdo.mount() turns them into real DOM and keeps it updated
 *   2. State           : Hdo.getState() / Hdo.setState() — one global store
 *   3. Routing         : Hdo.router() / Hdo.navigate() — the URL hash lives in state.route
 *   4. Events          : the `on` prop, and Hdo.on() for window/document events
 *
 * Load it with <script src="framework/hdo.js"></script>; everything is on window.Hdo.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * 1. Virtual DOM
   * ------------------------------------------------------------- */

  // h('div', { class: 'box' }, 'text', h('span', null, 'child'), [more, children])
  // returns { tag, props, children } — a plain object, not a DOM node.
  function h(tag, props) {
    var children = [];
    addChildren(Array.prototype.slice.call(arguments, 2), children);
    return { tag: tag, props: props || {}, children: children };
  }

  // Strings/numbers become text nodes, arrays are flattened,
  // null/false/undefined are skipped (handy for conditions).
  function addChildren(list, out) {
    list.forEach(function (child) {
      if (Array.isArray(child)) addChildren(child, out);
      else if (typeof child === 'string' || typeof child === 'number') out.push({ text: String(child) });
      else if (child && child.tag) out.push(child);
    });
  }

  // Elements with `autofocus` that were just created; focused after the render.
  var toFocus = null;

  // Build a real DOM node from a virtual node.
  function create(vnode) {
    if (vnode.text !== undefined) {
      vnode.el = document.createTextNode(vnode.text);
      return vnode.el;
    }
    var el = document.createElement(vnode.tag);
    vnode.el = el;
    updateProps(el, vnode.props, {});
    vnode.children.forEach(function (child) { el.appendChild(create(child)); });
    if (vnode.props.autofocus) toFocus = el;
    return el;
  }

  // Make the real node of `oldNode` look like `newNode`. Returns the DOM node.
  function patch(oldNode, newNode) {
    var el = oldNode.el;
    newNode.el = el;
    if (newNode.text !== undefined) {
      if (el.nodeValue !== newNode.text) el.nodeValue = newNode.text;
      return el;
    }
    updateProps(el, newNode.props, oldNode.props);
    updateChildren(el, oldNode.children, newNode.children);
    return el;
  }

  function sameKind(a, b) {
    return a.tag === b.tag && (a.text === undefined) === (b.text === undefined);
  }

  // Children are matched by their `key` prop, or by position when they have none.
  function idOf(vnode, index) {
    return vnode.props && vnode.props.key != null ? 'key:' + vnode.props.key : 'index:' + index;
  }

  function updateChildren(parent, oldChildren, newChildren) {
    var old = {};
    oldChildren.forEach(function (child, i) { old[idOf(child, i)] = child; });

    newChildren.forEach(function (child, i) {
      var id = idOf(child, i);
      var match = old[id];
      var el;
      if (match && sameKind(match, child)) {
        delete old[id];
        el = patch(match, child);
      } else {
        el = create(child);
      }
      // put the node at position i (no-op if it is already there)
      if (parent.childNodes[i] !== el) parent.insertBefore(el, parent.childNodes[i] || null);
    });

    // whatever was not reused is gone
    Object.keys(old).forEach(function (id) {
      var el = old[id].el;
      if (el.parentNode === parent) parent.removeChild(el);
    });
  }

  /* ---------------------------------------------------------------
   * Attributes and events
   * ------------------------------------------------------------- */

  function updateProps(el, props, oldProps) {
    Object.keys(oldProps).forEach(function (name) {
      if (!(name in props)) setProp(el, name, null);
    });
    Object.keys(props).forEach(function (name) {
      // value/checked are compared with the live element, since the user can change them
      if (name === 'value' || name === 'checked' || props[name] !== oldProps[name]) {
        setProp(el, name, props[name]);
      }
    });
  }

  function setProp(el, name, value) {
    if (name === 'key') return;
    if (name === 'on') {
      el._handlers = value || {};
      Object.keys(el._handlers).forEach(function (type) {
        // the same function is never added twice, so this is safe on every render
        el.addEventListener(type, callHandler);
      });
    } else if (name === 'value') {
      value = value == null ? '' : String(value);
      if (el.value !== value) el.value = value;
    } else if (name === 'checked') {
      el.checked = !!value;
    } else if (name === 'style' && value && typeof value === 'object') {
      el.style.cssText = '';
      Object.keys(value).forEach(function (k) { el.style[k] = value[k]; });
    } else if (value == null || value === false) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, value === true ? '' : value);
    }
  }

  // The only listener the framework ever adds to an element:
  // it looks up the current handler from the `on` prop and calls it.
  function callHandler(event) {
    var handler = this._handlers && this._handlers[event.type];
    if (handler) handler(event);
  }

  // Hdo.on(window, 'scroll', fn) — for things that are not created with h(),
  // like window or document. Returns a function that removes the handler.
  function on(target, type, handler) {
    target.addEventListener(type, handler);
    return function off() { target.removeEventListener(type, handler); };
  }

  /* ---------------------------------------------------------------
   * 2. State
   * ------------------------------------------------------------- */

  var state = {};
  var listeners = [];

  function getState() {
    return state;
  }

  // Merges `changes` into the state, then tells every subscriber.
  function setState(changes) {
    state = Object.assign({}, state, changes);
    listeners.slice().forEach(function (fn) { fn(state); });
  }

  // Returns a function that unsubscribes.
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  /* ---------------------------------------------------------------
   * Mount: the framework calls your view
   * ------------------------------------------------------------- */

  // Renders view() into container now, and again after every setState().
  function mount(view, container) {
    var current = null;

    function render() {
      var next = view();
      if (current && sameKind(current, next)) {
        patch(current, next);
      } else {
        container.innerHTML = '';
        container.appendChild(create(next));
      }
      current = next;
      if (toFocus) { toFocus.focus(); toFocus = null; }
    }

    render();
    return subscribe(render);
  }

  /* ---------------------------------------------------------------
   * 3. Routing
   * ------------------------------------------------------------- */

  // The part of the URL after '#', e.g. 'page.html#/active' -> '/active'.
  function currentRoute() {
    return location.hash.slice(1) || '/';
  }

  // Keeps state.route in sync with the URL (links, back/forward, typing the URL).
  function router() {
    window.addEventListener('hashchange', function () { setState({ route: currentRoute() }); });
    setState({ route: currentRoute() });
  }

  // Change the URL from code; state.route follows through 'hashchange'.
  function navigate(path) {
    location.hash = path;
  }

  // match('/user/:id', '/user/7') -> { id: '7' }   (null when it does not match)
  function match(pattern, path) {
    var a = pattern.split('/');
    var b = path.split('/');
    if (a.length !== b.length) return null;
    var params = {};
    for (var i = 0; i < a.length; i++) {
      if (a[i].charAt(0) === ':') params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) return null;
    }
    return params;
  }

  window.Hdo = {
    h: h,
    mount: mount,
    getState: getState,
    setState: setState,
    subscribe: subscribe,
    router: router,
    navigate: navigate,
    match: match,
    on: on
  };
})();
