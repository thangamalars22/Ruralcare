const assert = require('assert');
const { models: M, load, call, T } = require('./harness.js');
const appts = load('appointments');
const mk = async (role, name, extra = {}) => (await M.User.create({ role, name, ...extra }))._id;
const H = 3600 * 1000;
const at = (hours) => new Date(Math.ceil((Date.now() + hours * H) / 60000) * 60000).toISOString();
(async () => {
  const D1 = await mk('doctor', 'Dr One'), D2 = await mk('doctor', 'Dr Two');
  const P1 = await mk('patient', 'Pat One', { patientId: 'RC-11111' }), P2 = await mk('patient', 'Pat Two', { patientId: 'RC-22222' });
  const doc = (id) => T('doctor', id), pat = (id) => T('patient', id);

  // auth + validation
  assert.strictEqual((await call(appts, 'GET', '/')).statusCode, 401);
  assert.strictEqual((await call(appts, 'GET', '/', { token: 'tok:doctor:' + '0'.repeat(24) })).statusCode, 401, 'token for deleted account rejected');
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D1, date: at(-5) } })).statusCode, 400, 'past date');
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D1, date: 'garbage' } })).statusCode, 400);
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: 'abc', date: at(24) } })).statusCode, 400, 'bad doctor id');
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: P2, date: at(24) } })).statusCode, 404, 'cannot book a patient as doctor');
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D1, date: { $gt: 1 } } })).statusCode, 400, 'object date');

  // patient books -> pending, visible to both
  const t1 = at(48);
  const b = await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D1, date: t1, reason: 'Fever' } });
  assert.strictEqual(b.statusCode, 201); assert.strictEqual(b.body.status, 'pending'); assert.strictEqual(b.body.createdBy, 'patient');
  const id1 = b.body._id;
  assert.strictEqual((await call(appts, 'GET', '/', { token: doc(D1) })).body.length, 1, 'doctor sees it');
  assert.strictEqual((await call(appts, 'GET', '/', { token: pat(P1) })).body.length, 1, 'patient sees it');
  assert.strictEqual((await call(appts, 'GET', '/', { token: doc(D2) })).body.length, 0, 'other doctor does not');
  assert.strictEqual((await call(appts, 'GET', '/', { token: pat(P2) })).body.length, 0, 'other patient does not');

  // duplicates / conflicts
  const dup = await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D1, date: t1 } });
  assert.strictEqual(dup.statusCode, 409, 'exact duplicate blocked');
  const near = await call(appts, 'POST', '/', { token: pat(P2), body: { doctor: D1, date: new Date(+new Date(t1) + 15 * 60000).toISOString() } });
  assert.strictEqual(near.statusCode, 409, 'overlapping slot for same doctor blocked');
  const patClash = await call(appts, 'POST', '/', { token: pat(P1), body: { doctor: D2, date: t1 } });
  assert.strictEqual(patClash.statusCode, 409, 'patient cannot be in two places');
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P2), body: { doctor: D1, date: new Date(+new Date(t1) + 30 * 60000).toISOString() } })).statusCode, 201, '30 min later is fine');

  // doctor confirm / patient cannot
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: pat(P1), body: { status: 'confirmed' } })).statusCode, 403, 'patient cannot confirm own request');
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: doc(D2), body: { status: 'confirmed' } })).statusCode, 404, 'other doctor cannot touch it');
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: pat(P2), body: { status: 'cancelled' } })).statusCode, 404, 'other patient cannot touch it');
  const conf = await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: { status: 'confirmed' } });
  assert.strictEqual(conf.body.status, 'confirmed');

  // doctor reschedules -> stays confirmed, same record, both see new time
  const t2 = at(72);
  const rs = await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: { date: t2 } });
  assert.strictEqual(rs.statusCode, 200); assert.strictEqual(rs.body._id, id1); assert.strictEqual(rs.body.status, 'confirmed');
  assert.strictEqual(new Date(rs.body.date).toISOString(), new Date(t2).toISOString());
  assert.strictEqual(rs.body.history.at(-1).action, 'rescheduled');
  const seen = (await call(appts, 'GET', '/', { token: pat(P1) })).body.find((a) => a._id === id1);
  assert.strictEqual(new Date(seen.date).toISOString(), new Date(t2).toISOString(), 'patient sees the doctor\'s new time');
  assert.strictEqual((await call(appts, 'GET', '/', { token: doc(D1) })).body.filter((a) => a._id === id1).length, 1, 'no duplicate record created by reschedule');
  // old slot freed
  assert.strictEqual((await call(appts, 'POST', '/', { token: pat(P2), body: { doctor: D1, date: t1 } })).statusCode, 201 - 0 === 201 ? 201 : 0, 'old slot is free again');
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: { date: t2 } })).statusCode, 400, 'same time rejected');
  // patient reschedule -> pending again
  const pr = await call(appts, 'PATCH', `/${id1}`, { token: pat(P1), body: { date: at(96) } });
  assert.strictEqual(pr.body.status, 'pending', 'patient change needs doctor OK');

  // cancel by doctor -> patient sees cancelled; further changes blocked; slot freed
  const cx = await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: { status: 'cancelled' } });
  assert.strictEqual(cx.body.status, 'cancelled');
  assert.strictEqual((await call(appts, 'GET', '/', { token: pat(P1) })).body.find((a) => a._id === id1).status, 'cancelled');
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: { status: 'confirmed' } })).statusCode, 409, 'cancelled is final');
  assert.strictEqual((await call(appts, 'PATCH', `/zzz`, { token: doc(D1), body: { status: 'confirmed' } })).statusCode, 404);
  assert.strictEqual((await call(appts, 'PATCH', `/${id1}`, { token: doc(D1), body: {} })).statusCode, 409 /* final first */);

  // doctor creates for NEW patient -> pending, awaiting patient; grants no access until accepted
  const { isLinked } = require('../src/lib/helpers.js');
  const dc = await call(appts, 'POST', '/', { token: doc(D2), body: { patient: P2, date: at(120), reason: 'Review' } });
  assert.strictEqual(dc.statusCode, 201); assert.strictEqual(dc.body.status, 'pending'); assert.strictEqual(dc.body.createdBy, 'doctor');
  assert.strictEqual(await isLinked(D2, P2), false, 'unaccepted doctor-created appointment gives NO access');
  assert.strictEqual((await call(appts, 'PATCH', `/${dc.body._id}`, { token: doc(D2), body: { status: 'confirmed' } })).statusCode, 409, 'doctor cannot self-confirm for the patient');
  assert.strictEqual((await call(appts, 'PATCH', `/${dc.body._id}`, { token: pat(P1), body: { status: 'confirmed' } })).statusCode, 404, 'other patient cannot accept');
  assert.strictEqual((await call(appts, 'PATCH', `/${dc.body._id}`, { token: pat(P2), body: { status: 'confirmed' } })).body.status, 'confirmed', 'patient accepts');
  assert.strictEqual(await isLinked(D2, P2), true, 'access granted after the patient accepts');
  // linked -> doctor-created is confirmed immediately
  const dc2 = await call(appts, 'POST', '/', { token: doc(D2), body: { patient: P2, date: at(200) } });
  assert.strictEqual(dc2.body.status, 'confirmed');
  // patient role cannot create for others; doctor cannot create with bad patient
  assert.strictEqual((await call(appts, 'POST', '/', { token: doc(D2), body: { patient: D1, date: at(300) } })).statusCode, 404);
  // completion
  assert.strictEqual((await call(appts, 'PATCH', `/${dc2.body._id}`, { token: pat(P2), body: { status: 'completed' } })).statusCode, 403);
  assert.strictEqual((await call(appts, 'PATCH', `/${dc2.body._id}`, { token: doc(D2), body: { status: 'completed' } })).body.status, 'completed');
  // race: unique index backstop
  const A = M.Appointment; const t3 = new Date(at(400));
  const a1 = A.syncActive(new A({ doctor: D1, patient: P1, date: t3, status: 'pending' })); await a1.save();
  const a2 = A.syncActive(new A({ doctor: D1, patient: P2, date: t3, status: 'pending' }));
  await assert.rejects(a2.save(), (e) => e.code === 11000, 'unique index blocks a simultaneous double booking');
  console.log('appointment tests passed');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
