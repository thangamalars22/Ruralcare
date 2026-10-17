const assert = require('assert');
const { models: M, load, call, T } = require('./harness.js');
const rxr = load('prescriptions');
const mk = async (role, name, extra = {}) => (await M.User.create({ role, name, ...extra }))._id;
(async () => {
  const D1 = await mk('doctor', 'Dr One', { specialization: 'GP', clinic: 'Clinic A' }), D2 = await mk('doctor', 'Dr Two');
  const P1 = await mk('patient', 'Pat One', { patientId: 'RC-11111', age: 40 }), P2 = await mk('patient', 'Pat Two', { patientId: 'RC-22222' });
  const future = (h) => new Date(Date.now() + h * 3600000);
  const ap1 = await M.Appointment.create({ doctor: D1, patient: P1, date: future(24), status: 'confirmed' });
  await M.Appointment.create({ doctor: D2, patient: P1, date: future(48), status: 'pending' }); // D2 also linked to P1
  const apOther = await M.Appointment.create({ doctor: D1, patient: P2, date: future(30), status: 'pending' });
  const d1 = T('doctor', D1), d2 = T('doctor', D2), p1 = T('patient', P1), p2 = T('patient', P2);
  const med = (n, over = {}) => ({ name: n, dosage: '1 tablet', route: 'Oral', frequency: 'Twice a day', duration: '5 days', instructions: 'After food', ...over });
  const body = { patient: P1, appointment: ap1._id, diagnosis: 'Viral fever', notes: 'Rest', followUpDate: '2026-11-01', medicines: [med('Paracetamol 500mg'), med('Cetirizine 10mg', { duration: '1 week' })] };

  // ---- create (draft) ----
  assert.strictEqual((await call(rxr, 'POST', '/', { body })).statusCode, 401);
  assert.strictEqual((await call(rxr, 'POST', '/', { token: p1, body })).statusCode, 403, 'patient cannot prescribe');
  assert.strictEqual((await call(rxr, 'POST', '/', { token: T('doctor', M.User.__rows()[1]._id), body: { ...body, patient: P2 } })).statusCode, 403, 'doctor not linked to patient');
  assert.strictEqual((await call(rxr, 'POST', '/', { token: d1, body: { ...body, medicines: [] } })).statusCode, 400, 'needs a medicine');
  assert.strictEqual((await call(rxr, 'POST', '/', { token: d1, body: { ...body, medicines: [med('X', { route: 'Telepathy' })] } })).statusCode, 400, 'invalid route');
  assert.strictEqual((await call(rxr, 'POST', '/', { token: d1, body: { ...body, medicines: 'nope' } })).statusCode, 400);
  assert.strictEqual((await call(rxr, 'POST', '/', { token: d1, body: { ...body, appointment: apOther._id } })).statusCode, 400, 'appointment must belong to this doctor+patient');
  assert.strictEqual((await call(rxr, 'POST', '/', { token: d1, body: { ...body, followUpDate: 'not-a-date' } })).statusCode, 400);
  const c = await call(rxr, 'POST', '/', { token: d1, body });
  assert.strictEqual(c.statusCode, 201); assert.strictEqual(c.body.publishStatus, 'draft'); assert.match(c.body.rxNumber, /^RX-[0-9A-F]{8}$/);
  assert.strictEqual(c.body.medicines.length, 2); assert.strictEqual(c.body.history[0].action, 'created');
  const id = c.body._id;

  // ---- drafts are private ----
  assert.strictEqual((await call(rxr, 'GET', '/', { token: p1 })).body.length, 0, 'patient does not see draft in list');
  assert.strictEqual((await call(rxr, 'GET', `/${id}`, { token: p1 })).statusCode, 404, 'patient cannot fetch draft');
  assert.strictEqual((await call(rxr, 'GET', `/${id}/pdf`, { token: p1 })).statusCode, 404, 'patient cannot get draft pdf');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: d2, query: { patient: P1 } })).body.length, 0, 'other doctor cannot see my draft');
  assert.strictEqual((await call(rxr, 'GET', `/${id}`, { token: d2 })).statusCode, 404);
  assert.strictEqual((await call(rxr, 'PUT', `/${id}`, { token: d2, body })).statusCode, 404, 'other doctor cannot edit');
  assert.strictEqual((await call(rxr, 'POST', `/${id}/publish`, { token: d2, body: { confirm: true } })).statusCode, 404, 'other doctor cannot publish');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: d1, query: { patient: P1 } })).body.length, 1, 'owner sees draft');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: d1 })).body.length, 1, 'doctor list (all mine)');
  assert.strictEqual((await call(rxr, 'GET', `/${id}/pdf`, { token: d1 })).statusCode, 409, 'no pdf for a draft, even for the doctor');

  // ---- edit draft ----
  const e = await call(rxr, 'PUT', `/${id}`, { token: d1, body: { ...body, diagnosis: 'Viral fever + cough', medicines: [med('Paracetamol 500mg'), med('Cetirizine 10mg', { duration: '1 week' }), med('Cough syrup', { route: 'Oral', dosage: '10 ml' })] } });
  assert.strictEqual(e.statusCode, 200); assert.strictEqual(e.body.medicines.length, 3); assert.strictEqual(e.body.version, 1); assert.strictEqual(e.body.publishStatus, 'draft');

  // ---- publish needs explicit approval + complete data ----
  assert.strictEqual((await call(rxr, 'POST', `/${id}/publish`, { token: d1, body: {} })).statusCode, 400, 'no confirm -> not published');
  assert.strictEqual((await call(rxr, 'POST', `/${id}/publish`, { token: d1, body: { confirm: 'yes' } })).statusCode, 400, 'confirm must be literal true');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: p1 })).body.length, 0, 'still hidden');
  const inc = await call(rxr, 'POST', '/', { token: d1, body: { ...body, medicines: [med('Half done', { frequency: '' })] } });
  assert.strictEqual(inc.statusCode, 201, 'incomplete draft can be saved');
  const incPub = await call(rxr, 'POST', `/${inc.body._id}/publish`, { token: d1, body: { confirm: true } });
  assert.strictEqual(incPub.statusCode, 400); assert.match(incPub.body.message, /frequency/);
  const pub = await call(rxr, 'POST', `/${id}/publish`, { token: d1, body: { confirm: true } });
  assert.strictEqual(pub.statusCode, 200); assert.strictEqual(pub.body.publishStatus, 'published'); assert.ok(pub.body.publishedAt);
  assert.ok(pub.body.endDate, 'end date computed from durations'); 
  const days = Math.round((new Date(pub.body.endDate) - new Date(pub.body.publishedAt)) / 86400000); assert.strictEqual(days, 7);
  assert.strictEqual((await call(rxr, 'POST', `/${id}/publish`, { token: d1, body: { confirm: true } })).statusCode, 409, 'cannot publish twice');

  // ---- patient sync ----
  const mine = await call(rxr, 'GET', '/', { token: p1 });
  assert.strictEqual(mine.body.length, 1); assert.strictEqual(mine.body[0].medicines.length, 3); assert.strictEqual(mine.body[0].history, undefined, 'patient never gets history');
  assert.strictEqual(mine.body[0].doctor.name, 'Dr One');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: p2 })).body.length, 0, 'other patient sees nothing');
  assert.strictEqual((await call(rxr, 'GET', `/${id}`, { token: p2 })).statusCode, 404);
  assert.strictEqual((await call(rxr, 'GET', '/', { token: p2, query: { patient: P1 } })).body.length, 0, 'patient cannot override ?patient');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: d2, query: { patient: P1 } })).body.length, 1, 'linked doctor sees published one');
  assert.strictEqual((await call(rxr, 'GET', '/', { token: d2, query: { patient: P2 } })).statusCode, 403, 'unlinked patient');

  // ---- pdf ----
  const pdf = await call(rxr, 'GET', `/${id}/pdf`, { token: p1, query: { download: '1' } });
  assert.strictEqual(pdf.statusCode, 200); assert.strictEqual(pdf.headers['Content-Type'], 'application/pdf');
  assert.ok(pdf.raw.subarray(0, 5).toString() === '%PDF-'); assert.match(pdf.headers['Content-Disposition'], /^attachment; filename="prescription-RX-/);
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(),'rx-route.pdf'), pdf.raw);
  assert.strictEqual((await call(rxr, 'GET', `/${id}/pdf`, { token: d1 })).statusCode, 200, 'prescribing doctor can print');
  assert.strictEqual((await call(rxr, 'GET', `/${id}/pdf`, { token: p2 })).statusCode, 404, 'other patient blocked');
  assert.strictEqual((await call(rxr, 'GET', `/${id}/pdf`, { token: d2 })).statusCode, 404, 'other doctor blocked');
  assert.strictEqual((await call(rxr, 'GET', `/nope/pdf`, { token: p1 })).statusCode, 404);

  // ---- revise published: history + version, patient sees updated content ----
  const rev = await call(rxr, 'PUT', `/${id}`, { token: d1, body: { ...body, diagnosis: 'Revised dx', medicines: [med('Paracetamol 650mg')] } });
  assert.strictEqual(rev.statusCode, 200); assert.strictEqual(rev.body.version, 2); assert.strictEqual(rev.body.publishStatus, 'published');
  const h = rev.body.history.find((x) => x.action === 'revised'); assert.ok(h); assert.strictEqual(h.snapshot.diagnosis, 'Viral fever + cough'); assert.strictEqual(h.snapshot.medicines.length, 3);
  assert.strictEqual((await call(rxr, 'GET', '/', { token: p1 })).body[0].diagnosis, 'Revised dx');
  assert.strictEqual((await call(rxr, 'PUT', `/${id}`, { token: d1, body: { ...body, medicines: [med('X', { dosage: '' })] } })).statusCode, 400, 'live prescription must stay complete');

  // ---- delete / complete ----
  assert.strictEqual((await call(rxr, 'DELETE', `/${id}`, { token: d1 })).statusCode, 409, 'published cannot be deleted');
  assert.strictEqual((await call(rxr, 'DELETE', `/${inc.body._id}`, { token: d2 })).statusCode, 404);
  assert.strictEqual((await call(rxr, 'DELETE', `/${inc.body._id}`, { token: d1 })).statusCode, 200, 'own draft deletable');
  assert.strictEqual((await call(rxr, 'PATCH', `/${id}/complete`, { token: p1 })).statusCode, 403);
  assert.strictEqual((await call(rxr, 'PATCH', `/${id}/complete`, { token: d1 })).body.status, 'completed');

  // ---- legacy single-medicine record stays visible ----
  await M.Prescription.create({ patient: P1, doctor: D1, medicine: 'Old Amoxicillin', dosage: '1 cap', frequency: '3x', startDate: new Date(Date.now() - 864e5 * 10), endDate: new Date(Date.now() - 864e5 * 5) });
  const all = (await call(rxr, 'GET', '/', { token: p1 })).body;
  const legacy = all.find((x) => x.medicine === 'Old Amoxicillin');
  assert.ok(legacy, 'legacy record visible'); assert.strictEqual(legacy.medicines[0].name, 'Old Amoxicillin'); assert.strictEqual(legacy.publishStatus, 'published'); assert.strictEqual(legacy.status, 'expired');
  assert.strictEqual((await call(rxr, 'GET', `/${legacy._id}/pdf`, { token: p1 })).statusCode, 200, 'legacy pdf works');
  console.log('prescription tests passed');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
