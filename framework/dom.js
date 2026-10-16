import { setEvent, removeEvent } from "./events.js";

// h("div", { class: "box" }, "hello") -> { tag, attrs, children }
export function h(tag, attrs = {}, ...children) {
  return {
    tag,
    attrs: attrs || {},
    children: children
      .flat(Infinity)
      .filter(c => c != null && c !== false && c !== true)
      .map(c => (typeof c === "object" ? c : String(c))), // text = plain string
  };
}

// Turn a virtual node into a real DOM node
export function createElement(vnode) {
  if (typeof vnode === "string") return document.createTextNode(vnode);
  const el = document.createElement(vnode.tag);
  for (const [key, value] of Object.entries(vnode.attrs)) setAttr(el, key, value);
  vnode.children.forEach(child => el.appendChild(createElement(child)));
  if (vnode.attrs.autofocus) queueMicrotask(() => el.focus());
  return el;
}

function setAttr(el, key, value, old) {
  if (key === "key") return; // only used by the diff, never put in the DOM
  if (key.startsWith("on")) return setEvent(el, key.slice(2).toLowerCase(), value);
  if (key === "style") return setStyle(el, value, old);
  if (key === "value" || key === "checked") {
    if (el[key] !== value) el[key] = value; // properties, not attributes
    return;
  }
  if (value === false || value == null) return el.removeAttribute(key);
  el.setAttribute(key, value === true ? "" : value);
}

function removeAttr(el, key) {
  if (key === "key") return;
  if (key.startsWith("on")) return removeEvent(el, key.slice(2).toLowerCase());
  if (key === "checked") el.checked = false;
  if (key === "value") el.value = "";
  el.removeAttribute(key);
}

// style can be a string ("color: red") or an object ({ color: "red", transform: "..." })
function setStyle(el, value, old) {
  if (value == null || typeof value === "string") return (el.style.cssText = value || "");
  if (old == null || typeof old === "string") {
    el.style.cssText = "";
    old = {};
  }
  for (const prop in old) if (!(prop in value)) setStyleProp(el, prop, "");
  for (const prop in value) if (value[prop] !== old[prop]) setStyleProp(el, prop, value[prop]);
}

function setStyleProp(el, prop, value) {
  if (prop.startsWith("--")) el.style.setProperty(prop, value); // CSS variables
  else el.style[prop] = value;
}

function keyOf(vnode) {
  return typeof vnode === "object" ? vnode.attrs.key : undefined;
}

// Compare old and new virtual trees and only touch the real DOM where they differ
export function patch(parent, oldV, newV, index = 0) {
  const el = parent.childNodes[index];
  if (oldV == null) return parent.appendChild(createElement(newV));
  if (newV == null) return parent.removeChild(el);
  if (oldV === newV) return; // same object reused: nothing changed
  if (typeof oldV === "string" && typeof newV === "string") return (el.nodeValue = newV);
  if (typeof oldV !== typeof newV || oldV.tag !== newV.tag || keyOf(oldV) !== keyOf(newV)) {
    return parent.replaceChild(createElement(newV), el);
  }
  updateElement(el, oldV, newV);
}

// Same tag: update attributes, then children
function updateElement(el, oldV, newV) {
  for (const key in oldV.attrs) if (!(key in newV.attrs)) removeAttr(el, key);
  for (const [key, value] of Object.entries(newV.attrs)) {
    const old = oldV.attrs[key];
    if (old !== value || key === "value" || key === "checked") setAttr(el, key, value, old);
  }

  const o = oldV.children, n = newV.children;
  if (n.length > 0 && n.every(c => keyOf(c) != null)) return patchKeyed(el, o, n);

  // no keys: patch children by position, then remove extras from the end
  for (let i = 0; i < n.length; i++) patch(el, o[i], n[i], i);
  for (let i = o.length - 1; i >= n.length; i--) el.removeChild(el.childNodes[i]);
}

// Keyed children: an element follows its key, even if items are added/removed/moved
function patchKeyed(el, o, n) {
  const nodes = [...el.childNodes];
  const oldByKey = new Map();
  o.forEach((c, i) => {
    if (keyOf(c) != null) oldByKey.set(keyOf(c), { vnode: c, node: nodes[i] });
  });

  n.forEach((c, i) => {
    const old = oldByKey.get(keyOf(c));
    let node;
    if (old && old.vnode.tag === c.tag) {
      node = old.node;
      oldByKey.delete(keyOf(c));
      if (old.vnode !== c) updateElement(node, old.vnode, c);
    } else {
      node = createElement(c);
    }
    if (el.childNodes[i] !== node) el.insertBefore(node, el.childNodes[i] || null);
  });

  // everything after the new children is old and unused
  while (el.childNodes.length > n.length) el.removeChild(el.lastChild);
}

// Render view(state) into root, and re-render on every state change.
// view can return one node or an array of nodes.
export function mount(view, root, store) {
  let oldNodes = [];

  const render = () => [view(store.getState())].flat(Infinity).filter(n => n != null && n !== false && n !== true);

  // Wipe the root and build every node from scratch.
  const fullRender = newNodes => {
    while (root.firstChild) root.removeChild(root.firstChild);
    newNodes.forEach(n => root.appendChild(createElement(n)));
    return newNodes;
  };

  const update = () => {
    const newNodes = render();
    try {
      for (let i = 0; i < newNodes.length; i++) patch(root, oldNodes[i], newNodes[i], i);
      for (let i = oldNodes.length - 1; i >= newNodes.length; i--) root.removeChild(root.childNodes[i]);
      oldNodes = newNodes;
    } catch (err) {
      // Real DOM no longer matches what the diff expects (edited directly).
      console.warn("mini-framework: patch failed, re-rendering from scratch", err);
      oldNodes = fullRender(newNodes);
    }
  };

  store.subscribe(update);
  update();
}
