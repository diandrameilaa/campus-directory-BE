const assert = require('assert');
const Module = require('module');

const queries = [];
const dbMock = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });

    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '1' }] };
    if (/FROM categories c/i.test(sql) && /COUNT\(p\.id\)/i.test(sql)) {
      return { rows: [{ id: 1, name: 'Cafe', icon: 'coffee', color: '#F59E0B', place_count: 5 }] };
    }
    if (/FROM places p/i.test(sql)) {
      return {
        rows: [{
          id: 1,
          name: 'Kafe Literasi',
          address: 'Jl. Kampus Raya No.1',
          lat: -7.5558,
          lng: 112.2278,
          category_id: 1,
          category_name: 'Cafe',
          distance_km: 0.2,
        }],
      };
    }
    return { rows: [] };
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../config/db') return dbMock;
  return originalLoad.apply(this, arguments);
};

const places = require('../src/controllers/places.controller');
const categories = require('../src/controllers/categories.controller');

const makeRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const run = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
};

(async () => {
  await run('GET /api/categories returns JSON data', async () => {
    queries.length = 0;
    const res = makeRes();
    await categories.getAll({}, res, (err) => { throw err; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data[0].name, 'Cafe');
  });

  await run('GET /api/places supports category name filter', async () => {
    queries.length = 0;
    const res = makeRes();
    await places.getAll({ query: { category: 'cafe', page: '1', limit: '20' } }, res, (err) => { throw err; });
    assert.equal(res.statusCode, 200);
    assert.match(queries[0].sql, /c\.name ILIKE/);
    assert.equal(queries[0].params[0], 'cafe');
  });

  await run('GET /api/places supports category id filter', async () => {
    queries.length = 0;
    const res = makeRes();
    await places.getAll({ query: { category: '1', page: '1', limit: '20' } }, res, (err) => { throw err; });
    assert.equal(res.statusCode, 200);
    assert.match(queries[0].sql, /p\.category_id = \$1/);
    assert.equal(queries[0].params[0], 1);
  });

  await run('GET /api/places/nearby validates lat/lng', async () => {
    const res = makeRes();
    await places.nearby({ query: {} }, res, (err) => { throw err; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
  });

  await run('GET /api/places/nearby uses valid distance subquery', async () => {
    queries.length = 0;
    const res = makeRes();
    await places.nearby({ query: { lat: '-7.556', lng: '112.228', radius: '1', category: 'cafe' } }, res, (err) => { throw err; });
    assert.equal(res.statusCode, 200);
    assert.match(queries[0].sql, /nearby_places/);
    assert.doesNotMatch(queries[0].sql, /\bHAVING\b/);
    assert.match(queries[0].sql, /c\.name ILIKE/);
  });
})();
