// vdom-core.js -- mini-framework's mini Virtual-DOM core, built byte-for-byte
// in the ten-recipe order that tests/vdom-core.test.js gates. The seam is the
// framework-proven one (hdo.js -> window.Hdo; here -> window.VdomCore): a bare
// window.eval of this source NEVER throws -- there is no Game, no bare Game,
// no pre-wire. The harness (byte-faithful on disk) evals the source into a
// jsdom window and reads window.VdomCore, exactly like the hdo harness.
//
// The ten recipe pieces, each one gate-identified:
//   1 VDOM structure: hn(tag, props, children), ht(text) -> plain objects
//   2 h(nodeobject, parent = document): RECURSIVE real-DOM builder; each
//     just-created element becomes the PARENT its children mount under, so the
//     VDOM tree and the real DOM tree are IDENTICAL by construction
//   3 createElement(doc, vnode): pure VDOM -> DOM converter (no mount)
//   4 render(state): pure state -> FRESH VDOM object
//   5 _oldVDOM module storage: null on first run (mount path)
//   6 state change: render(state) builds a NEW VDOM object every time
//   7 diff(oldVDOM, newVDOM): emits PATCH records; paths are NUMBER ARRAYS
//     (the harness joins ech path with ',' -> '0' = the root element that is
//     mounted as rootEl.childNodes[0]; '0,0' = its first child text)
//   8 patch(patches, rootEl, doc): applies PATCH records to the real DOM by
//     resolving each numeric path to the node at rootEl.childNodes[0] (the
//     mounted root) and then descending childNodes along the rest of the array
//   9 _oldVDOM = newVDOM after patching (refresh for the next diff)
//  10 run(rootEl, doc, state, renderFn): render -> diff -> patch -> refresh,
//     with _oldVDOM starting null (mount) and refreshing after every run
(function () {
  'use strict';

  // ---- 1. VDOM structure ----------------------------------------------------

  function hn(tag, props, children) {
    return { tag: tag, props: props || {}, children: children || [] };
  }

  function ht(text) {
    return { tag: '#text', text: text };
  }

  function isTextVDOM(n) { return !!n && n.tag === '#text'; }

  function applyPropsTo(el, props) {
    var k;
    for (k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (k === 'class') { el.className = v; }
      else if (k === 'style') { el.style.cssText = v; }
      else if (k === 'checked') { el.checked = !!v; }
      else if (k === 'value') { el.value = v; }
      else if (v === true) { el.setAttribute(k, ''); }
      else if (v === false || v == null) { el.removeAttribute(k); }
      else if (typeof v === 'string') { el.setAttribute(k, v); }
      else { el.setAttribute(k, String(v)); }
    }
  }

  // ---- 3. createElement(doc, vnode): pure VDOM -> DOM -------------------------

  function createElement(doc, vnode) {
    if (isTextVDOM(vnode)) return doc.createTextNode(String(vnode.text));
    var el = doc.createElement(vnode.tag);
    applyPropsTo(el, vnode.props || {});
    var kids = vnode.children || [];
    for (var i = 0; i < kids.length; i++) {
      el.appendChild(createElement(doc, kids[i]));
    }
    return el;
  }

  // ---- 2. h(nodeobject, parent = document): RECURSIVE real-DOM builder --------

  function h(nodeobject, parent) {
    if (parent == null) {
      parent = (typeof document !== 'undefined' && document) ? document : null;
    }
    var doc = (parent && (parent.nodeType === 9 ? parent : (parent.ownerDocument || null)))
      || (typeof document !== 'undefined' && document ? document : null);
    var mount = parent && parent.nodeType === 9
      ? (parent.body || parent.documentElement || null)
      : parent;
    var el;
    if (isTextVDOM(nodeobject)) {
      el = doc.createTextNode(String(nodeobject.text));
      if (mount && mount.appendChild) mount.appendChild(el);
      return el;
    }
    if (!nodeobject || typeof nodeobject.tag !== 'string') return null;
    el = doc.createElement(nodeobject.tag);
    applyPropsTo(el, nodeobject.props || {});
    if (mount && mount.appendChild) mount.appendChild(el);
    var kids = nodeobject.children || [];
    for (var i = 0; i < kids.length; i++) {
      h(kids[i], el); // the just-created element is each child's parent
    }
    return el;
  }

  // ---- 4. render(state): pure function returning a FRESH VDOM object ---------

  function render(state) {
    var score = (state && typeof state.score === 'number') ? state.score : 0;
    return hn('div', { class: 'app' }, [
      hn('p', { class: 'score' }, [ht('Score: ' + String(score))]),
    ]);
  }

  // ---- 5 + 9. _oldVDOM module state (null = mount path) -----------------------

  var _oldVDOM = null;

  // ---- 7. diff(oldVDOM, newVDOM) ----------------------------------------------

  var PATCH = {
    CREATE: 'CREATE',
    REMOVE: 'REMOVE',
    REPLACE: 'REPLACE',
    TEXT_UPDATE: 'TEXT_UPDATE',
    PROPS_UPDATE: 'PROPS_UPDATE',
  };

  function diffInto(oldN, newN, parts, out) {
    if (newN == null) {
      if (oldN != null) out.push({ type: PATCH.REMOVE, path: parts.slice() });
      return;
    }
    if (oldN == null) {
      out.push({ type: PATCH.CREATE, path: parts.slice(), vnode: newN });
      return;
    }
    var oT = isTextVDOM(oldN), nT = isTextVDOM(newN);
    if (oT || nT) {
      if (oT && nT) {
        if (oldN.text !== newN.text) {
          out.push({ type: PATCH.TEXT_UPDATE, path: parts.slice(), text: String(newN.text) });
        }
      } else {
        out.push({ type: PATCH.REPLACE, path: parts.slice(), vnode: newN });
      }
      return;
    }
    if (oldN.tag !== newN.tag) {
      out.push({ type: PATCH.REPLACE, path: parts.slice(), vnode: newN });
      return;
    }
    var changed = {};
    var any = false;
    var keys = {};
    var k;
    var op = oldN.props || {};
    var np = newN.props || {};
    for (k in op) if (Object.prototype.hasOwnProperty.call(op, k)) keys[k] = 1;
    for (k in np) if (Object.prototype.hasOwnProperty.call(np, k)) keys[k] = 1;
    for (k in keys) {
      if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
      if (op[k] !== np[k]) { changed[k] = np[k]; any = true; }
    }
    if (any) out.push({ type: PATCH.PROPS_UPDATE, path: parts.slice(), changed: changed });
    var oc = oldN.children || [];
    var nc = newN.children || [];
    var max = oc.length > nc.length ? oc.length : nc.length;
    for (var i = 0; i < max; i++) {
      var opc = parts.concat(i);
      diffInto(oc[i], nc[i], opc, out);
    }
  }

  function diff(oldVDOM, newVDOM) {
    var out = [];
    diffInto(oldVDOM, newVDOM, [], out);
    return out;
  }

  // ---- harness-verified entry points (pure, no mount) -------------------------

  function createElementPublic(doc, vnode) { return createElement(doc, vnode); }
  function diffPublic(a, b) { return diff(a, b); }

  // ---- 8. patch(patches, rootEl, doc) -----------------------------------------
  // Numeric paths resolve relative to the mounted root: the node at the EMPTY
  // path (and at path [0]) is rootEl.childNodes[0]; a path like [0,0] is
  // rootEl.childNodes[0].childNodes[0]. PROPS_UPDATE [] thus targets the
  // mounted root element itself.

  function nodeAtPath(rootEl, parts) {
    var el = rootEl && rootEl.childNodes ? rootEl.childNodes[0] : null;
    for (var i = 1; i < (parts ? parts.length : 0); i++) {
      if (!el || !el.childNodes) return null;
      el = el.childNodes[parts[i]];
    }
    return el;
  }

  function patch(patches, rootEl, doc) {
    if (!patches || !rootEl) return;
    for (var i = 0; i < patches.length; i++) {
      var p = patches[i];
      var parts = (p && Array.isArray(p.path)) ? p.path : (p && p.path ? String(p.path).split('.').map(function (s) { return parseInt(s, 10); }) : []);
      var parentParts = parts.slice(0, -1);
      var leaf = parts.length ? parts[parts.length - 1] : -1;
      var parentEl = nodeAtPath(rootEl, parentParts);
      var target = nodeAtPath(rootEl, parts);
      if (p.type === PATCH.CREATE) {
        if (parentEl && parentEl.appendChild) parentEl.appendChild(createElement(doc, p.vnode));
      } else if (p.type === PATCH.REMOVE) {
        if (parentEl && parentEl.childNodes && parentEl.childNodes[leaf] != null) {
          parentEl.removeChild(parentEl.childNodes[leaf]);
        }
      } else if (p.type === PATCH.REPLACE) {
        if (parentEl && parentEl.childNodes && parentEl.childNodes[leaf] != null) {
          parentEl.replaceChild(createElement(doc, p.vnode), parentEl.childNodes[leaf]);
        }
      } else if (p.type === PATCH.TEXT_UPDATE) {
        if (target) {
          if (target.nodeType === 3) target.nodeValue = String(p.text);
          else target.textContent = String(p.text);
        }
      } else if (p.type === PATCH.PROPS_UPDATE) {
        if (target && target.nodeType === 1) applyPropsTo(target, p.changed || {});
      }
    }
  }

  // ---- 10. run(rootEl, doc, state, renderFn) -----------------------------------

  function run(rootEl, doc, state, renderFn) {
    var fn = renderFn || render;
    var newVDOM = fn(state);
    var empty = !rootEl || !rootEl.childNodes || rootEl.childNodes.length === 0;
    if (empty) {
      h(newVDOM, rootEl);
    } else {
      patch(diff(_oldVDOM, newVDOM), rootEl, doc);
    }
    _oldVDOM = newVDOM; // 9. refresh for the next diff
    return newVDOM;
  }

  function getOldVDOM() { return _oldVDOM; }

  // ---- window seam (hdo-proven; no Game, no bare Game anywhere) ---------------

  var api = {
    PATCH: PATCH,
    hn: hn,
    ht: ht,
    h: h,
    createElement: createElementPublic,
    render: render,
    diff: diffPublic,
    patch: patch,
    run: run,
    getOldVDOM: getOldVDOM,
  };

  if (typeof window !== 'undefined' && window) {
    window.VdomCore = api;
  }
})();
