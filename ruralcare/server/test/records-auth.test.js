const os = require('os'), pth = require('path'); const STORE = pth.join(os.tmpdir(), 'rc-test-storage-' + process.pid); process.env.REPORTS_DIR = STORE;
const assert = require('assert'); const fs = require('fs');
const { models: M, load, call, T } = require('./harness.js');
const records = load('records'), auth = load('auth'), users = load('users'), messages = load('messages');
const mk = async (role, name, extra = {}) => (await M.User.create({ role, name, ...extra }))._id;
const PDF = Buffer.from('%PDF-1.4\nhello\n');
(async () => {
  const D1 = await mk('doctor', 'Dr One'), D2 = await mk('doctor', 'Dr Two');
  const P1 = await mk('patient', 'Pat One', { patientId: 'RC-11111' }), P2 = await mk('patient', 'Pat Two', { patientId: 'RC-22222' }), P3 = await mk('patient', 'Pat Three', { patientId: 'RC-33333' });
  await M.Appointment.create({ doctor: D1, patient: P1, date: new Date(Date.now() + 864e5), status: 'pending' });
  // doctor-created, NOT accepted: must not link
  await M.Appointment.create({ doctor: D1, patient: P3, date: new Date(Date.now() + 864e5), status: 'pending', createdBy: 'doctor' });
  const d1 = T('doctor', D1), d2 = T('doctor', D2), p1 = T('patient', P1), p2 = T('patient', P2);
  const today = new Date().toISOString().slice(0, 10);
  const good = { patient: P1, title: 'Fasting blood sugar', reportType: 'blood_sugar', visitDate: today, diagnosis: 'Normal', vitals: { bloodSugar: '96' } };

  // ----- records -----
  assert.strictEqual((await call(records, 'POST', '/', { token: p1, body: good })).statusCode, 403);
  assert.strictEqual((await call(records, 'POST', '/', { token: d2, body: good })).statusCode, 403, 'unlinked doctor');
  assert.strictEqual((await call(records, 'POST', '/', { token: d1, body: { ...good, patient: P3 } })).statusCode, 403, 'unaccepted doctor-created appointment gives no record access');
  assert.strictEqual((await call(records, 'POST', '/', { token: d1, body: { ...good, title: 123 } })).statusCode, 400, 'non-string title');
  assert.strictEqual((await call(records, 'POST', '/', { token: d1, body: { ...good, visitDate: '2999-01-01' } })).statusCode, 400);
  assert.strictEqual((await call(records, 'POST', '/', { token: d1, body: { ...good, reportType: 'bogus' } })).statusCode, 400);
  const c = await call(records, 'POST', '/', { token: d1, body: good }); assert.strictEqual(c.statusCode, 201); const rid = c.body._id;
  const put = (t, raw, id = rid) => call(records, 'PUT', `/${id}/file`, { token: t, raw });
  assert.strictEqual((await put(d2, PDF)).statusCode, 404); assert.strictEqual((await put(p1, PDF)).statusCode, 403);
  assert.strictEqual((await put(d1, Buffer.from('<script>x</script>'))).statusCode, 415);
  assert.strictEqual((await put(d1, PDF)).statusCode, 200);
  const list = await call(records, 'GET', '/', { token: p1 }); assert.strictEqual(list.body.length, 1); assert.ok(!('storageKey' in list.body[0].file), 'no storage path leaked');
  assert.strictEqual((await call(records, 'GET', '/', { token: p2 })).body.length, 0);
  assert.strictEqual((await call(records, 'GET', '/', { token: d2, query: { patient: P1 } })).statusCode, 403);
  const dl = await call(records, 'GET', `/${rid}/file`, { token: p1 }); assert.strictEqual(dl.statusCode, 200); assert.ok(dl.raw.equals(PDF));
  assert.strictEqual((await call(records, 'GET', `/${rid}/file`, { token: p2 })).statusCode, 404);
  assert.strictEqual((await call(records, 'GET', `/${rid}/file`, { token: d2 })).statusCode, 404);
  // doctor-wide list ("Medical Records" page): only MY records, with patient name/id, never another doctor's
  await M.Appointment.create({ doctor: D2, patient: P2, date: new Date(Date.now() + 864e5), status: 'pending' });
  const other = await call(records, 'POST', '/', { token: d2, body: { patient: P2, title: 'Other doctor report', reportType: 'xray', visitDate: today } });
  assert.strictEqual(other.statusCode, 201);
  const all1 = await call(records, 'GET', '/', { token: d1 });
  assert.strictEqual(all1.statusCode, 200);
  assert.deepStrictEqual(all1.body.map((r) => r.title), ['Fasting blood sugar'], 'doctor 1 sees only own records');
  assert.strictEqual(all1.body[0].patient.name, 'Pat One'); assert.strictEqual(all1.body[0].patient.patientId, 'RC-11111');
  assert.ok(!('storageKey' in (all1.body[0].file || {})), 'no storage path in doctor list');
  assert.deepStrictEqual((await call(records, 'GET', '/', { token: d2 })).body.map((r) => r.title), ['Other doctor report']);
  assert.strictEqual((await call(records, 'GET', '/', { token: p1, query: { patient: P2 } })).body.every((r) => String(r.patient) === String(P1)), true, 'patient cannot widen the list');
  assert.strictEqual((await call(records, 'GET', '/', { token: p2 })).body.map((r) => r.title).join(), 'Other doctor report', 'patient 2 sees the report their own doctor wrote');
  // edit details
  assert.strictEqual((await call(records, 'PATCH', `/${rid}`, { token: d2, body: good })).statusCode, 404, 'other doctor cannot edit');
  assert.strictEqual((await call(records, 'PATCH', `/${rid}`, { token: p1, body: good })).statusCode, 403);
  const ed = await call(records, 'PATCH', `/${rid}`, { token: d1, body: { ...good, title: 'Fasting sugar (repeat)', diagnosis: 'Borderline', patient: P2 } });
  assert.strictEqual(ed.statusCode, 200); assert.strictEqual(ed.body.title, 'Fasting sugar (repeat)'); assert.strictEqual(String(ed.body.patient), String(P1), 'patient cannot be reassigned');
  assert.ok((await call(records, 'GET', `/${rid}/file`, { token: p1 })).raw.equals(PDF), 'file still attached after edit');
  assert.strictEqual((await call(records, 'DELETE', `/${rid}`, { token: d2 })).statusCode, 404);
  assert.strictEqual((await call(records, 'DELETE', `/${rid}`, { token: d1 })).statusCode, 200);

  // ----- auth -----
  const reg = (b, ip) => call(auth, 'POST', '/register', { body: b, ip });
  assert.strictEqual((await reg({ role: 'patient', name: 123, email: 'a@b.co', password: 'password1', age: 30 })).statusCode, 400, 'non-string name');
  assert.strictEqual((await reg({ role: 'patient', name: 'X', email: 'a@b.co', password: { $ne: 1 }, age: 30 })).statusCode, 400, 'object password');
  assert.strictEqual((await reg({ role: 'patient', name: 'X', email: 'a@b.co', password: 'short', age: 30 })).statusCode, 400);
  assert.strictEqual((await reg({ role: 'patient', name: 'X', phone: 'abc', password: 'password1', age: 30 })).statusCode, 400, 'bad phone');
  assert.strictEqual((await reg({ role: 'patient', name: 'X', email: 'a@b.co', password: 'password1', age: '' })).statusCode, 400, 'blank age');
  assert.strictEqual((await reg({ role: 'admin', name: 'X', email: 'a@b.co', password: 'password1' })).statusCode, 400, 'cannot self-register as another role');
  const ok = await reg({ role: 'patient', name: 'New Pat', email: 'New@B.co', password: 'password1', age: 30 }); assert.strictEqual(ok.statusCode, 201);
  assert.ok(!('passwordHash' in ok.body.user), 'hash not returned'); assert.match(ok.body.user.patientId, /^RC-\d{5}$/);
  assert.strictEqual((await reg({ role: 'patient', name: 'Dup', email: 'new@b.co', password: 'password1', age: 30 })).statusCode, 409, 'dup email');
  const login = (b, ip) => call(auth, 'POST', '/login', { body: b, ip });
  assert.strictEqual((await login({ identifier: 'new@b.co', password: 'password1', role: 'patient' })).statusCode, 200);
  assert.strictEqual((await login({ identifier: 'new@b.co', password: 'password1', role: 'doctor' })).statusCode, 401, 'wrong role chosen');
  assert.strictEqual((await login({ identifier: { $ne: '' }, password: 'x' })).statusCode, 400, 'NoSQL-style identifier rejected');
  assert.strictEqual((await login({ identifier: 'new@b.co', password: { $ne: '' } })).statusCode, 400);
  for (let i = 0; i < 10; i++) await login({ identifier: 'victim@x.co', password: 'bad' + i }, '9.9.9.9');
  assert.strictEqual((await login({ identifier: 'victim@x.co', password: 'bad' }, '9.9.9.9')).statusCode, 429, 'brute force throttled');
  assert.strictEqual((await login({ identifier: 'new@b.co', password: 'password1' }, '8.8.8.8')).statusCode, 200, 'other clients unaffected');
  const me = await call(auth, 'GET', '/me', { token: ok.body.token }); assert.strictEqual(me.statusCode, 200);
  assert.strictEqual((await call(auth, 'GET', '/me', { token: 'garbage' })).statusCode, 401);
  assert.strictEqual((await call(auth, 'PUT', '/me', { token: ok.body.token, body: { age: 'abc' } })).statusCode, 400);
  assert.strictEqual((await call(auth, 'PUT', '/me', { token: ok.body.token, body: { name: { x: 1 } } })).statusCode, 400);
  assert.strictEqual((await call(auth, 'PUT', '/me', { token: ok.body.token, body: { name: 'Renamed', age: 31 } })).body.user.name, 'Renamed');

  // ----- users -----
  assert.strictEqual((await call(users, 'GET', '/patients', { token: p1 })).statusCode, 403, 'patient cannot list patients');
  const pl = await call(users, 'GET', '/patients', { token: d1 }); assert.deepStrictEqual(pl.body.map((x) => x.name), ['Pat One'], 'only linked patients (not unaccepted)');
  assert.strictEqual((await call(users, 'GET', `/patients/${P2}`, { token: d1 })).statusCode, 403);
  assert.strictEqual((await call(users, 'GET', `/patients/${P3}`, { token: d1 })).statusCode, 403, 'proposed-but-unaccepted patient not accessible');
  assert.strictEqual((await call(users, 'GET', `/patients/xyz`, { token: d1 })).statusCode, 404);
  const lk = await call(users, 'GET', '/patients/lookup', { token: d1, query: { patientId: 'rc-22222' } }); assert.strictEqual(lk.statusCode, 200); assert.deepStrictEqual(Object.keys(lk.body).sort(), ['_id', 'age', 'name', 'patientId'].sort().filter((k) => k in lk.body));
  assert.ok(!('phone' in lk.body) && !('email' in lk.body), 'lookup reveals no contact info');
  assert.strictEqual((await call(users, 'GET', '/patients/lookup', { token: d1, query: { patientId: 'bad' } })).statusCode, 400);
  assert.strictEqual((await call(users, 'GET', '/patients/lookup', { token: p1, query: { patientId: 'RC-22222' } })).statusCode, 403);

  // ----- messages -----
  assert.strictEqual((await call(messages, 'POST', '/', { token: d2, body: { to: P1, text: 'hi' } })).statusCode, 403, 'unlinked doctor cannot message');
  assert.strictEqual((await call(messages, 'POST', '/', { token: d1, body: { to: P3, text: 'hi' } })).statusCode, 403, 'unaccepted link cannot message');
  assert.strictEqual((await call(messages, 'POST', '/', { token: d1, body: { to: P1, text: { a: 1 } } })).statusCode, 400);
  assert.strictEqual((await call(messages, 'POST', '/', { token: p1, body: { to: 'zzz', text: 'hi' } })).statusCode, 400);
  assert.strictEqual((await call(messages, 'POST', '/', { token: p1, body: { to: D1, text: 'hello' } })).statusCode, 201);
  assert.strictEqual((await call(messages, 'GET', '/thread/zzz', { token: p1 })).statusCode, 404);
  assert.strictEqual((await call(messages, 'GET', `/thread/${P1}`, { token: d1 })).body.length, 1);
  assert.strictEqual((await call(messages, 'GET', `/thread/${P1}`, { token: d2 })).body.length, 0, 'third party sees nothing');
  console.log('records/auth/users/messages tests passed');
  fs.rmSync(STORE, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
