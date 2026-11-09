// Read-only integration checks against the local catalog; no customer records are changed.
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/beloz';
process.env.AI_RESPONSE_MODE = 'fast';
const assert = require('node:assert/strict');
const app = require('../server');
const pool = require('../models/dbpostgre');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const checks = [];
  async function check(path, status = 200, options) {
    const response = await fetch(base + path, options);
    assert.equal(response.status, status, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const data = await response.json();
    checks.push(`${path}: ${status}`);
    return data;
  }
  try {
    await check('/');
    assert.equal((await check('/salud')).db, 'ok');
    const restaurants = await check('/api/restaurantes');
    assert.ok(Array.isArray(restaurants) && restaurants.length > 0);
    for (const query of ['C', 'tagli', 'sus', 'xyznotfound']) {
      const result = await check(`/api/restaurantes/search?query=${query}`);
      assert.ok(Array.isArray(result));
      if (query === 'xyznotfound') assert.equal(result.length, 0);
    }
    await check('/api/pedidos?user_id=1', 401);
    for (const message of ['hola', 'quiero sushi hasta 12 euros', 'capital de Francia', 'ramen sin gluten']) {
      const data = await check('/api/chat', 200, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
      });
      assert.equal(typeof data.respuesta, 'string');
      if (message.includes('hasta')) assert.ok(data.sugerencias.every(item => item.price != null && item.price <= 12));
      if (message.includes('gluten') || message.includes('Francia')) assert.equal(data.sugerencias.length, 0);
    }
    console.log(JSON.stringify({ passed: checks, restaurants: restaurants.length }));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
})().catch(() => { console.error('Local integration check failed.'); process.exitCode = 1; });
