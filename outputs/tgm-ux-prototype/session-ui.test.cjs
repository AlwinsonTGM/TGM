// Exercise the prototype event handlers without launching a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const dataName = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
class Element {
  constructor(tag, doc) {
    this.tag = tag; this.doc = doc; this.attributes = {}; this.children = [];
    this.listeners = {}; this.parentNode = null; this.value = ''; this._text = '';
    this.classList = {
      contains: name => (this.attributes.class || '').split(/\s+/).includes(name),
      toggle: (name, force) => {
        const set = new Set((this.attributes.class || '').split(/\s+/).filter(Boolean));
        if (force === undefined ? !set.has(name) : force) set.add(name); else set.delete(name);
        this.attributes.class = [...set].join(' ');
      },
      remove: name => this.classList.toggle(name, false)
    };
    this.dataset = new Proxy({}, {
      get: (_, key) => this.attributes[`data-${dataName(key)}`],
      set: (_, key, value) => { this.attributes[`data-${dataName(key)}`] = String(value); return true; }
    });
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  set className(value) { this.attributes.class = value; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this._text = String(value); this.children = []; }
  append(child) { child.parentNode = this; this.children.push(child); }
  remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { for (const callback of this.listeners[type] || []) callback({ target: this, preventDefault() {} }); }
  focus() { this.doc.activeElement = this; }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (match(node, selector)) return node; return null; }
  querySelector(selector) { return query(this, selector)[0] || null; }
  cloneNode(deep) {
    const clone = new Element(this.tag, this.doc);
    clone.attributes = { ...this.attributes }; clone._text = this._text; clone.value = this.value;
    if (deep) this.children.forEach(child => clone.append(child.cloneNode(true)));
    return clone;
  }
}
function match(node, selector) {
  const tag = selector.match(/^[\w-]+/);
  if (tag && node.tag !== tag[0]) return false;
  const id = selector.match(/#([\w-]+)/);
  if (id && node.attributes.id !== id[1]) return false;
  for (const cls of selector.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(cls[1])) return false;
  for (const attr of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!node.hasAttribute(attr[1]) || (attr[2] !== undefined && node.attributes[attr[1]] !== attr[2])) return false;
  }
  return true;
}
function query(root, selector) {
  const parts = selector.match(/(?:[^\s\[\]]|\[[^\]]+\])+/g);
  const found = [];
  function visit(node) {
    for (const child of node.children) {
      if (match(child, parts.at(-1))) {
        let ancestor = child.parentNode, i = parts.length - 2;
        while (i >= 0 && ancestor) { if (match(ancestor, parts[i])) i--; ancestor = ancestor.parentNode; }
        if (i < 0) found.push(child);
      }
      visit(child);
    }
  }
  visit(root); return found;
}
function makeDocument(html) {
  const doc = { activeElement: null };
  const root = new Element('document', doc), stack = [root];
  const tags = html.match(/<\/?[a-zA-Z][^>]*>/g) || [];
  for (const token of tags) {
    if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    const tag = token.match(/^<([\w-]+)/)[1].toLowerCase();
    const el = new Element(tag, doc);
    const attrs = token.slice(tag.length + 1, -1);
    for (const attr of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) el.setAttribute(attr[1], attr[2] || '');
    stack.at(-1).append(el);
    if (!voids.has(tag) && !token.endsWith('/>')) stack.push(el);
  }
  doc.querySelectorAll = selector => query(root, selector);
  doc.querySelector = selector => doc.querySelectorAll(selector)[0] || null;
  doc.createElement = tag => new Element(tag, doc);
  for (const select of doc.querySelectorAll('select')) select.value = select.querySelector('option')?.attributes.value || select.querySelector('option')?._text || '';
  return doc;
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'prototype.js'), 'utf8');
const document = makeDocument(html);
const window = { location: { search: '' }, scrollTo() {} };
vm.runInNewContext(source, { document, window, URLSearchParams, setInterval() {} });
const get = selector => { const element = document.querySelector(selector); assert.ok(element, selector); return element; };
const transcript = () => document.querySelectorAll('#terminal-output [data-transcript-line]').map(item => item.textContent).join('\n');
const cmd = text => { get('#terminal-command').value = text; get('#terminal-command').dispatch('input'); get('#terminal-form').dispatch('submit'); };

get('.session[data-session="Functions practice"]').dispatch('click');
assert.equal(document.activeElement, get('#workspace-title'));
assert.equal(get('#workspace-harness').value, 'agy');
cmd('alpha');
assert.match(transcript(), /alpha/);
get('#terminal-command').value = 'unsent agy draft';
get('#terminal-command').dispatch('input');
get('#workspace-harness').value = 'opencode';
get('#workspace-harness').dispatch('change');
assert.equal(get('#terminal-command').value, '');
assert.doesNotMatch(transcript(), /alpha/);
const other = document.querySelectorAll('.session').find(item => item.attributes['aria-label'] === 'Functions practice, OpenCode session');
assert.ok(other, 'new harness session is reachable from the sidebar');
cmd('beta');
get('.session[data-session="Functions practice"]').dispatch('click');
assert.equal(get('#workspace-harness').value, 'agy');
assert.equal(get('#terminal-command').value, 'unsent agy draft');
assert.match(transcript(), /alpha/);
assert.doesNotMatch(transcript(), /beta/);
other.dispatch('click');
assert.equal(get('#workspace-harness').value, 'opencode');
assert.match(transcript(), /beta/);
assert.doesNotMatch(transcript(), /alpha/);
get('.nav[data-home]').dispatch('click');
assert.equal(document.activeElement, get('#home-title'));
get('#continue').dispatch('click');
assert.equal(get('#workspace-harness').value, 'opencode');
assert.match(transcript(), /beta/);
get('.nav[data-home]').dispatch('click');
get('#harness-choice').value = 'opencode';
get('#harness-choice').dispatch('change');
get('.open-step[data-session="Review study notes"]').dispatch('click');
assert.equal(get('#workspace-harness').value, 'opencode');
const reviewDefault = get('.session[data-session="Review study notes"]');
assert.equal(reviewDefault.attributes['aria-label'], 'Review study notes, AGY CLI session');
assert.ok(document.querySelectorAll('.session').some(item => item.attributes['aria-label'] === 'Review study notes, OpenCode session'));
reviewDefault.dispatch('click');
assert.equal(get('#workspace-harness').value, 'agy', 'step override must not mutate the original session');
console.log('PASS: session navigation, separate history and drafts, sidebar and focus');
