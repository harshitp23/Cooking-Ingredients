// Test harness: loads the real index.html in jsdom with a controllable
// localStorage and an in-memory fake of the Supabase client.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

export const tick = (ms = 1) => new Promise((r) => setTimeout(r, ms));

/** A Storage implementation whose backing Map can be shared across "reloads". */
export function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    _map: map,
  };
}

const TABLES = ['kitchen_items', 'kitchen_recipes', 'kitchen_recipe_items'];

/** Fresh in-memory database. */
export function makeDb(seed = {}) {
  const db = {};
  for (const t of TABLES) db[t] = (seed[t] || []).map((r) => ({ ...r }));
  return db;
}

/** Apply one queue op directly to the in-memory db (used to simulate the server). */
export function applyToDb(db, op) {
  const arr = db[op.table];
  if (!arr) return;
  if (op.kind === 'insert') {
    if (!arr.some((r) => r.id === op.row.id)) arr.push({ ...op.row });
  } else if (op.kind === 'update') {
    arr.forEach((r) => { if (r.id === op.id) Object.assign(r, op.patch); });
  } else if (op.kind === 'delete') {
    db[op.table] = arr.filter((r) => r.id !== op.id);
  }
}

/**
 * Fake Supabase client backed by `db`.
 * opts.onWrite(op)  -> called before each write; throw to simulate a failure.
 * opts.session      -> the session object (default { user: { id: 'u1' } })
 * opts.loggedIn     -> false to start signed out
 */
export function makeClient(db, opts = {}) {
  const session = opts.session === undefined ? { user: { id: 'u1' } } : opts.session;
  const auth = {
    getSession: async () => ({ data: { session: opts.loggedIn === false ? null : session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: { session }, error: null }),
    signOut: async () => ({ error: null }),
  };
  const from = (table) => ({
    select: async () => ({ data: db[table].map((r) => ({ ...r })), error: null }),
    upsert: async (row, o) => {
      if (opts.onWrite) await opts.onWrite({ table, kind: 'insert', row });
      const arr = db[table];
      const i = arr.findIndex((r) => r.id === row.id);
      if (i === -1) arr.push({ ...row });
      else if (!(o && o.ignoreDuplicates)) arr[i] = { ...arr[i], ...row };
      return { data: null, error: null };
    },
    update: (patch) => ({
      eq: async (col, val) => {
        if (opts.onWrite) await opts.onWrite({ table, kind: 'update', id: val, patch });
        db[table].forEach((r) => { if (r[col] === val) Object.assign(r, patch); });
        return { data: null, error: null };
      },
    }),
    delete: () => ({
      eq: async (col, val) => {
        if (opts.onWrite) await opts.onWrite({ table, kind: 'delete', id: val });
        db[table] = db[table].filter((r) => r[col] !== val);
        return { data: null, error: null };
      },
    }),
  });
  return { auth, from };
}

/**
 * Boot the app in jsdom.
 * - storage: a makeStorage() instance (pass the same one twice to simulate reload)
 * - client:  a fake client (from makeClient) or undefined for no backend
 */
export async function loadApp({ storage = makeStorage(), client } = {}) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'https://kitchen.test/',
    pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
      window.crypto = globalThis.crypto;
      if (client) window.supabase = { createClient: () => client };
    },
  });
  await new Promise((res) => {
    if (dom.window.document.readyState === 'complete') res();
    else dom.window.addEventListener('load', res);
  });
  await tick(5); // let boot()'s async getSession()/reconcile() settle
  return { dom, window: dom.window, K: dom.window.Kitchen, storage };
}

/** Click the current undo toast's button, if shown. */
export function clickUndo(window) {
  const btn = window.document.querySelector('#toast .toast-undo');
  if (!btn || btn.hidden || window.document.getElementById('toast').hidden) {
    throw new Error('no undo toast visible');
  }
  btn.click();
}

/** Deep clone helper for snapshots. */
export const clone = (v) => JSON.parse(JSON.stringify(v));

/** Sort a row list by id for order-independent comparison. */
export const byId = (rows) => clone(rows).sort((a, b) => String(a.id).localeCompare(String(b.id)));
