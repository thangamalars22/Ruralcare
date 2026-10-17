// Logic tests with NO dependencies and NO database: runs the REAL route files against an in-memory stand-in for
// express / mongoose / bcrypt / jwt. It checks authorization, validation and workflow rules. It does not replace a
// test against a real MongoDB (indexes, casting and Mongoose behaviour are only approximated here).
const Module = require('module');
const { Writable } = require('stream');
const assert = require('assert');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src') + path.sep;

let counter = 0;
const newId = () => (++counter).toString(16).padStart(24, '0');
const isObj = (v) => v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v);
function clone(v) {
  if (v instanceof Date) return new Date(+v);
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v) && !(v instanceof OID)) { const o = {}; for (const k of Object.keys(v)) o[k] = clone(v[k]); return o; }
  return v;
}
class OID { constructor(v) { this.v = String(v); } toString() { return this.v; } toJSON() { return this.v; } }

const eq = (a, b) => {
  if (a == null && b == null) return true;
  if (a instanceof Date || b instanceof Date) return +new Date(a) === +new Date(b);
  return String(a) === String(b);
};
const get = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const cmp = (a, b) => (+new Date(a)) - (+new Date(b));
function matchCond(v, cond) {
  if (isObj(cond) && Object.keys(cond).some((k) => k.startsWith('$'))) {
    return Object.entries(cond).every(([op, x]) => {
      switch (op) {
        case '$ne': return !(Array.isArray(v) ? v.some((y) => eq(y, x)) : eq(v, x));
        case '$in': return x.some((y) => (Array.isArray(v) ? v.some((z) => eq(z, y)) : eq(v, y)));
        case '$nin': return !x.some((y) => eq(v, y));
        case '$exists': return x ? v !== undefined : v === undefined;
        case '$gte': return v != null && cmp(v, x) >= 0;
        case '$gt': return v != null && cmp(v, x) > 0;
        case '$lte': return v != null && cmp(v, x) <= 0;
        case '$lt': return v != null && cmp(v, x) < 0;
        default: throw new Error('harness: unsupported operator ' + op);
      }
    });
  }
  return Array.isArray(v) ? v.some((y) => eq(y, cond)) : eq(v, cond);
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, c]) => {
    if (k === '$or') return c.some((f) => matches(doc, f));
    if (k === '$and') return c.every((f) => matches(doc, f));
    return matchCond(get(doc, k), c);
  });
}

const REFS = { patient: 'User', doctor: 'User', appointment: 'Appointment', from: 'User', to: 'User' };
const models = {};

function makeModel(name, { defaults = () => ({}), hidden = [], statics = {}, required = [] } = {}) {
  const rows = [];
  const strip = (o, plus) => { const c = clone(o); if (!plus) for (const h of hidden) { const parts = h.split('.'); let t = c; for (let i = 0; i < parts.length - 1 && t; i++) t = t[parts[i]]; if (t) delete t[parts[parts.length - 1]]; } return c; };
  function toPlain(doc) { const o = {}; for (const k of Object.keys(doc)) o[k] = clone(doc[k]); return o; }
  function instantiate(row, isNew) {
    const doc = clone(row);
    const def = (k, fn) => Object.defineProperty(doc, k, { value: fn, enumerable: false, writable: true });
    def('__new', isNew); def('__plus', false); def('__pop', new Set());
    def('save', async () => {
      for (const r of required) if (get(doc, r) == null || get(doc, r) === '') throw Object.assign(new Error(`${r} is required`), { name: 'ValidationError', errors: { [r]: { message: `${r} is required` } } });
      const stored = toPlain(doc);
      for (const p of doc.__pop) if (isObj(stored[p]) && stored[p]._id) stored[p] = stored[p]._id;
      for (const spec of M.uniques || []) { // enforce unique partial indexes
        if (!spec.when(stored)) continue;
        const clash = rows.find((r) => String(r._id) !== String(stored._id) && spec.when(r) && spec.keys.every((k) => eq(get(r, k), get(stored, k))));
        if (clash) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: Object.fromEntries(spec.keys.map((k) => [k, 1])) });
      }
      stored.updatedAt = new Date();
      const i = rows.findIndex((r) => String(r._id) === String(stored._id));
      if (i >= 0) rows[i] = stored; else { stored.createdAt = new Date(); rows.push(stored); }
      doc.__new = false; return doc;
    });
    def('toObject', () => strip(toPlain(doc), doc.__plus));
    def('toJSON', () => strip(toPlain(doc), doc.__plus));
    def('deleteOne', async () => { const i = rows.findIndex((r) => String(r._id) === String(doc._id)); if (i >= 0) rows.splice(i, 1); });
    def('set', (o) => { Object.assign(doc, o); return doc; });
    def('markModified', () => {});
    def('populate', async (path, sel) => { populateDoc(doc, path, sel); return doc; });
    for (const k of Object.keys(doc)) if (Array.isArray(doc[k])) doc[k].forEach((x) => { if (isObj(x)) Object.defineProperty(x, 'toObject', { value: () => clone(x), enumerable: false }); });
    return doc;
  }
  function populateDoc(doc, path, sel) {
    const ref = models[REFS[path]]; const id = isObj(doc[path]) ? doc[path]._id : doc[path];
    if (!ref || id == null) return;
    const row = ref.__rows().find((r) => String(r._id) === String(id));
    if (!row) { doc[path] = null; return; }
    const fields = sel ? ['_id', ...sel.split(/\s+/)] : null;
    const o = {}; for (const k of Object.keys(row)) if (!fields || fields.includes(k)) o[k] = clone(row[k]);
    doc[path] = o; doc.__pop.add(path);
  }
  class Query {
    constructor(filter, one, kind) { Object.assign(this, { filter: filter || {}, one, kind, _sort: null, _pop: [], _plus: false, _lean: false, _limit: 0 }); }
    sort(s) { this._sort = s; return this; }
    populate(p, sel) { this._pop.push([p, sel]); return this; }
    select(s) { if (typeof s === 'string') { if (s.includes('+')) this._plus = true; const toks = s.split(/\s+/).filter(Boolean); if (toks.length && toks.every((t) => !t.startsWith('+') && !t.startsWith('-'))) this._proj = ['_id', ...toks]; } return this; }
    lean() { this._lean = true; return this; }
    limit(n) { this._limit = n; return this; }
    exec() {
      let out = rows.filter((r) => matches(r, this.filter));
      if (this._sort) { const keys = this._sort.split(/\s+/).filter(Boolean); out = [...out].sort((a, b) => { for (const k of keys) { const d = k.startsWith('-') ? -1 : 1; const f = k.replace(/^-/, ''); const c = (get(a, f) instanceof Date ? cmp(get(a, f), get(b, f)) : String(get(a, f)).localeCompare(String(get(b, f)))); if (c) return c * d; } return 0; }); }
      if (this._limit) out = out.slice(0, this._limit);
      const mk = (r0) => { let r = r0; if (this._proj) { r = {}; for (const k of this._proj) if (r0[k] !== undefined) r[k] = clone(r0[k]); } if (this._lean) return clone(r); const d = instantiate(r, false); d.__plus = this._plus; this._pop.forEach(([p, s]) => populateDoc(d, p, s)); return d; };
      return this.one ? (out[0] ? mk(out[0]) : null) : out.map(mk);
    }
    then(a, b) { return Promise.resolve().then(() => this.exec()).then(a, b); }
  }
  function M(obj) { const d = instantiate({ _id: newId(), ...defaults(), ...clone(obj || {}) }, true); return d; }
  Object.assign(M, {
    __rows: () => rows, __reset: () => { rows.length = 0; },
    create: async (obj) => { const d = M(obj); await d.save(); return d; },
    find: (f) => new Query(f, false),
    findOne: (f) => new Query(f, true),
    findById: (id) => new Query({ _id: id }, true),
    exists: async (f) => { const r = rows.find((x) => matches(x, f)); return r ? { _id: r._id } : null; },
    countDocuments: async (f) => rows.filter((r) => matches(r, f)).length,
    distinct: async (field, f) => [...new Set(rows.filter((r) => matches(r, f)).map((r) => String(get(r, field))))],
    updateMany: async (f, upd) => { rows.filter((r) => matches(r, f)).forEach((r) => Object.assign(r, upd)); },
    aggregate: async (p) => { const m = p[0].$match; const g = {}; rows.filter((r) => matches(r, m)).forEach((r) => { const k = String(r.patient); g[k] = g[k] && cmp(g[k], r.visitDate) > 0 ? g[k] : r.visitDate; }); return Object.entries(g).map(([k, v]) => ({ _id: k, last: v })); },
    ...statics,
  });
  models[name] = M;
  return M;
}

const live = (s) => s.status === 'pending' || s.status === 'confirmed';
makeModel('User', { required: ['name', 'role'] });
makeModel('Appointment', {
  defaults: () => ({ status: 'pending', createdBy: 'patient', reason: 'General consultation', history: [] }),
  statics: { syncActive: (a) => { a.active = ['pending', 'confirmed'].includes(a.status) ? true : undefined; return a; } },
});
models.Appointment.uniques = [
  { keys: ['doctor', 'date'], when: (r) => r.active === true },
  { keys: ['patient', 'date'], when: (r) => r.active === true },
];
makeModel('MedicalRecord', { defaults: () => ({ type: 'consultation', reportType: 'general' }), hidden: ['file.storageKey'], required: ['title'] });
makeModel('Prescription', { defaults: () => ({ version: 1, status: 'active', startDate: new Date(), history: [], medicines: [] }) });
makeModel('Message');
const MR = models.MedicalRecord; MR.REPORT_TYPES = ['blood_sugar', 'blood_pressure', 'xray', 'blood_test', 'urine_test', 'ecg', 'imaging', 'laboratory', 'prescription', 'general', 'other'];

// ---- express / mongoose / jwt / bcrypt stand-ins ----
const mkRouter = () => { const r = { uses: [], routes: [] }; for (const m of ['get', 'post', 'put', 'delete', 'patch']) r[m] = (p, ...h) => r.routes.push({ m: m.toUpperCase(), p, h }); r.use = (...h) => r.uses.push(...h); return r; };
const expressStub = () => ({}); expressStub.Router = mkRouter; expressStub.raw = () => (req, _res, next) => { req.body = req.rawBody || {}; next(); }; expressStub.json = () => (_q, _s, n) => n();
const jwtStub = { sign: (p) => `tok:${p.role}:${p.id}`, verify: (t) => { if (typeof t !== 'string' || !t.startsWith('tok:')) throw new Error('bad'); const [, role, id] = t.split(':'); return { role, id }; } };
const bcryptStub = { hash: async (pw) => 'h:' + pw, compare: async (pw, h) => h === 'h:' + pw };
const mongooseStub = { Types: { ObjectId: OID }, model: () => ({}), Schema: class {} };

const orig = Module._load;
Module._load = function (req, parent, ...a) {
  if (req === 'express') return expressStub;
  if (req === 'jsonwebtoken') return jwtStub;
  if (req === 'bcryptjs') return bcryptStub;
  if (req === 'mongoose') return mongooseStub;
  const m = /models\/(\w+)$/.exec(req); if (m && models[m[1]]) return models[m[1]];
  return orig.call(this, req, parent, ...a);
};
process.env.JWT_SECRET = 'test-secret-test-secret'; 

class Res extends Writable {
  constructor() { super(); this.statusCode = 200; this.headers = {}; this.chunks = []; this.finishedP = new Promise((r) => { this._done = r; }); }
  _write(c, _e, cb) { this.chunks.push(Buffer.from(c)); cb(); }
  status(c) { this.statusCode = c; return this; }
  set(h, v) { if (typeof h === 'string') this.headers[h] = v; else Object.assign(this.headers, h); return this; }
  json(o) { this.body = JSON.parse(JSON.stringify(o)); this.headers['Content-Type'] = 'application/json'; this._done(); return this; }
  send(b) { this.raw = Buffer.from(b); this._done(); return this; }
  destroy() { this._done(); }
  end(...a) { super.end(...a); this.raw = this.raw || Buffer.concat(this.chunks); this._done(); }
}
const load = (name) => require(SRC + 'routes/' + name + '.js');

async function call(router, method, url, { token, body, raw, query = {}, ip = '1.1.1.1' } = {}) {
  const route = router.routes.find((r) => r.m === method && new RegExp('^' + r.p.replace(/:[a-zA-Z]+/g, '([^/]+)') + '$').test(url));
  assert.ok(route, `no route ${method} ${url}`);
  const m = new RegExp('^' + route.p.replace(/:[a-zA-Z]+/g, '([^/]+)') + '$').exec(url);
  const names = [...route.p.matchAll(/:([a-zA-Z]+)/g)].map((x) => x[1]);
  const req = { method, ip, headers: { authorization: token ? `Bearer ${token}` : '', 'x-file-name': encodeURIComponent('My Report.pdf') }, params: Object.fromEntries(names.map((n, i) => [n, m[i + 1]])), query, body: body || {}, rawBody: raw };
  const res = new Res();
  try {
    for (const fn of [...router.uses, ...route.h]) {
      const step = await new Promise((resolve, reject) => {
        let settled = false;
        const next = (e) => { settled = true; e ? reject(e) : resolve('next'); };
        res.finishedP.then(() => resolve('done'));
        Promise.resolve(fn(req, res, next)).then(() => { if (!settled) setTimeout(() => resolve('wait'), 0); }, reject);
      });
      if (step === 'done' || step === 'wait') { await Promise.race([res.finishedP, new Promise((r) => setTimeout(r, 400))]); break; }
    }
  } catch (e) {
    if (e.name === 'CastError') { res.statusCode = 400; res.body = { message: 'invalid' }; }
    else if (e.name === 'ValidationError') { res.statusCode = 400; res.body = { message: e.message }; }
    else if (e.code === 11000) { res.statusCode = 409; res.body = { message: 'duplicate' }; }
    else { res.statusCode = 500; res.body = { message: 'SERVER ERROR: ' + e.stack }; }
  }
  return res;
}
const T = (role, id) => `tok:${role}:${id}`;
module.exports = { models, load, call, T, newId, Module };
