const { body, query } = require('express-validator');
const db        = require('../config/db');
const respond   = require('../utils/response');
const haversine = require('../utils/haversine');

// ── Validation rules ────────────────────────────────────────────
const placeRules = [
  body('name').trim().notEmpty().withMessage('Nama tempat wajib diisi'),
  body('category_id').isInt({ min: 1 }).withMessage('category_id harus angka valid'),
  body('lat').isFloat({ min: -90,  max: 90  }).withMessage('Latitude tidak valid (-90 s/d 90)'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude tidak valid (-180 s/d 180)'),
  body('address').optional().trim(),
  body('description').optional().trim(),
  body('phone').optional().trim(),
  body('open_hours').optional().trim(),
  body('price_range').optional().trim(),
  body('website').optional({ checkFalsy: true }).isURL().withMessage('Website harus URL valid'),
  body('tags').optional().custom((value) => {
    if (Array.isArray(value) || typeof value === 'string') return true;
    throw new Error('Tags harus array atau teks dipisahkan koma');
  }),
];

// ── Shared place SELECT ─────────────────────────────────────────
const PLACE_SELECT = `
  SELECT
    p.id, p.name, p.address, p.lat, p.lng,
    p.description, p.phone, p.open_hours, p.website,
    p.photo_url, p.photos, p.tags, p.price_range,
    p.rating, p.review_count, p.is_verified,
    p.created_at, p.updated_at,
    c.id   AS category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color
  FROM places p
  JOIN categories c ON c.id = p.category_id
`;

// ── GET /api/places ─────────────────────────────────────────────
// ?category=1 &search=kafe &lat=-7.5 &lng=112.2
// &radius=2   &sort=distance|rating|name
// &tags=wifi,ac &page=1 &limit=20
const getAll = async (req, res, next) => {
  try {
    const {
      category, search, lat, lng, radius,
      tags, sort = 'name', page = 1, limit = 20,
    } = req.query;

    const offset = (Math.max(parseInt(page), 1) - 1) * Math.max(parseInt(limit), 1);
    const params = [];
    const where  = ['p.is_active = TRUE'];

    if (category) {
      const categoryId = Number.parseInt(category, 10);
      if (Number.isInteger(categoryId) && String(categoryId) === String(category).trim()) {
        params.push(categoryId);
        where.push(`p.category_id = $${params.length}`);
      } else {
        params.push(category);
        where.push(`c.name ILIKE $${params.length}`);
      }
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.address ILIKE $${params.length})`);
    }
    if (tags) {
      const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
      params.push(tagArr);
      where.push(`p.tags && $${params.length}`);   // overlap operator
    }

    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const sortMap  = { rating: 'p.rating DESC', name: 'p.name ASC' };
    const orderBy  = sortMap[sort] || 'p.name ASC';

    params.push(parseInt(limit), offset);
    const mainSQL = `${PLACE_SELECT} ${whereSQL} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const cntSQL  = `SELECT COUNT(*) FROM places p ${whereSQL}`;
    const cntPrms = params.slice(0, -2);

    const [{ rows }, { rows: cnt }] = await Promise.all([
      db.query(mainSQL, params),
      db.query(cntSQL, cntPrms),
    ]);

    // Attach + filter by distance
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    let data = rows;

    if (!isNaN(userLat) && !isNaN(userLng)) {
      data = rows.map(p => ({
        ...p,
        distance_km: parseFloat(haversine(userLat, userLng, p.lat, p.lng).toFixed(2)),
      }));
      if (radius) data = data.filter(p => p.distance_km <= parseFloat(radius));
      if (sort === 'distance') data.sort((a, b) => a.distance_km - b.distance_km);
    }

    const total = parseInt(cnt[0].count);
    respond.paginated(res, data, {
      total, page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

// ── GET /api/places/nearby ──────────────────────────────────────
// ?lat= &lng= &radius=1 &category= &limit=20
const nearby = async (req, res, next) => {
  try {
    const { lat, lng, radius = 1, category, limit = 20 } = req.query;

    if (!lat || !lng) return respond.error(res, 'Parameter lat dan lng wajib diisi.', 400);

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const km      = parseFloat(radius);
    if (isNaN(userLat) || isNaN(userLng)) return respond.error(res, 'lat/lng harus berupa angka.', 400);

    // Bounding box kasar untuk performa
    const latD = km / 111;
    const lngD = km / (111 * Math.cos((userLat * Math.PI) / 180));
    const params = [userLat - latD, userLat + latD, userLng - lngD, userLng + lngD];

    const where = [
      'p.is_active = TRUE',
      `p.lat BETWEEN $1 AND $2`,
      `p.lng BETWEEN $3 AND $4`,
    ];

    if (category) {
      const categoryId = Number.parseInt(category, 10);
      if (Number.isInteger(categoryId) && String(categoryId) === String(category).trim()) {
        params.push(categoryId);
        where.push(`p.category_id = $${params.length}`);
      } else {
        params.push(category);
        where.push(`c.name ILIKE $${params.length}`);
      }
    }

    // Haversine SQL untuk urutan dan filter presisi
    const havSQL = `
      (6371 * acos(
        LEAST(1.0, cos(radians($${params.length + 1})) *
        cos(radians(p.lat)) *
        cos(radians(p.lng) - radians($${params.length + 2})) +
        sin(radians($${params.length + 1})) *
        sin(radians(p.lat)))
      ))
    `;

    params.push(userLat, userLng, km, parseInt(limit));

    const sql = `
      SELECT * FROM (
        SELECT
          p.id, p.name, p.address, p.lat, p.lng,
          p.photo_url, p.rating, p.review_count, p.open_hours,
          p.price_range, p.tags, p.is_verified,
          c.id AS category_id, c.name AS category_name,
          c.icon AS category_icon, c.color AS category_color,
          ${havSQL} AS distance_km
        FROM places p
        JOIN categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')}
      ) nearby_places
      WHERE distance_km <= $${params.length - 1}
      ORDER BY distance_km ASC
      LIMIT $${params.length}
    `;

    const { rows } = await db.query(sql, params);
    const data = rows.map(r => ({
      ...r,
      distance_km: parseFloat(parseFloat(r.distance_km).toFixed(2)),
    }));

    respond.success(res, data, `${data.length} tempat dalam radius ${km} km`);
  } catch (err) { next(err); }
};

// ── GET /api/places/:id ─────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const { rows } = await db.query(
      `${PLACE_SELECT} WHERE p.id=$1 AND p.is_active=TRUE`,
      [req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Tempat tidak ditemukan.', 404);

    const place = rows[0];
    const uLat  = parseFloat(lat);
    const uLng  = parseFloat(lng);
    if (!isNaN(uLat) && !isNaN(uLng)) {
      place.distance_km = parseFloat(haversine(uLat, uLng, place.lat, place.lng).toFixed(2));
    }
    respond.success(res, place);
  } catch (err) { next(err); }
};

// ── POST /api/places [admin] ────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const {
      category_id, name, address, lat, lng,
      description, phone, open_hours, website,
      price_range, tags,
    } = req.body;

    const photo_url = req.file ? `/uploads/${req.file.filename}` : req.body.photo_url || null;

    const { rows } = await db.query(
      `INSERT INTO places
         (category_id, name, address, lat, lng, description, phone,
          open_hours, website, photo_url, price_range, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [category_id, name, address, lat, lng, description, phone,
       open_hours, website, photo_url, price_range,
       tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : null,
       req.user.id]
    );
    respond.success(res, rows[0], 'Tempat berhasil ditambahkan.', 201);
  } catch (err) { next(err); }
};

// ── PUT /api/places/:id [admin] ─────────────────────────────────
const update = async (req, res, next) => {
  try {
    const {
      category_id, name, address, lat, lng,
      description, phone, open_hours, website,
      price_range, tags, is_active, is_verified,
    } = req.body;

    const photo_url = req.file ? `/uploads/${req.file.filename}` : req.body.photo_url;

    const { rows } = await db.query(
      `UPDATE places SET
         category_id=$1, name=$2, address=$3, lat=$4, lng=$5,
         description=$6, phone=$7, open_hours=$8, website=$9,
         photo_url=$10, price_range=$11,
         tags=$12,
         is_active=$13, is_verified=$14
       WHERE id=$15
       RETURNING *`,
      [category_id, name, address, lat, lng,
       description, phone, open_hours, website,
       photo_url, price_range,
       tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : null,
       is_active !== undefined ? is_active : true,
       is_verified !== undefined ? is_verified : false,
       req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Tempat tidak ditemukan.', 404);
    respond.success(res, rows[0], 'Tempat berhasil diupdate.');
  } catch (err) { next(err); }
};

// ── DELETE /api/places/:id [admin] — soft delete ────────────────
const remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'UPDATE places SET is_active=FALSE WHERE id=$1',
      [req.params.id]
    );
    if (!rowCount) return respond.error(res, 'Tempat tidak ditemukan.', 404);
    respond.success(res, null, 'Tempat berhasil dihapus.');
  } catch (err) { next(err); }
};

// ── GET /api/places/:id/photos [admin] — list all photos ────────
const getPhotos = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT photo_url, photos FROM places WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Tempat tidak ditemukan.', 404);
    respond.success(res, {
      cover:  rows[0].photo_url,
      photos: rows[0].photos || [],
    });
  } catch (err) { next(err); }
};

// ── POST /api/places/:id/photos [admin] — add extra photo ───────
const addPhoto = async (req, res, next) => {
  try {
    if (!req.file) return respond.error(res, 'File gambar tidak ditemukan.', 400);
    const url = `/uploads/${req.file.filename}`;
    await db.query(
      `UPDATE places SET photos = array_append(COALESCE(photos, '{}'), $1) WHERE id=$2`,
      [url, req.params.id]
    );
    respond.success(res, { photo_url: url }, 'Foto berhasil ditambahkan.', 201);
  } catch (err) { next(err); }
};

module.exports = {
  getAll, nearby, getById, create, update, remove,
  getPhotos, addPhoto, placeRules,
};
