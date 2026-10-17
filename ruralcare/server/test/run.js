const { spawnSync } = require('child_process');
const path = require('path');
let failed = 0;
for (const f of ['appointments', 'prescriptions', 'records-auth']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f + '.test.js')], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
