const db      = require('../config/db');
const respond = require('../utils/response');

// ── GET /api/favorites [auth] ───────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         p.id, p.name, p.address, p.lat, p.lng,
         p.photo_url, p.rating, p.review_count,
         p.open_hours, p.price_range, p.tags,
         c.id AS category_id, c.name AS category_name,
         c.icon AS category_icon, c.color AS category_color,
         f.created_at AS saved_at
       FROM favorites f
       JOIN places     p ON p.id = f.place_id
       JOIN categories c ON c.id = p.category_id
       WHERE f.user_id=$1 AND p.is_active=TRUE
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    respond.success(res, rows);
  } catch (err) { next(err); }
};

// ── POST /api/favorites/:placeId [auth] ─────────────────────────
const add = async (req, res, next) => {
  try {
    // Validasi place exists
    const check = await db.query('SELECT id FROM places WHERE id=$1 AND is_active=TRUE', [req.params.placeId]);
    if (!check.rows.length) return respond.error(res, 'Tempat tidak ditemukan.', 404);

    await db.query(
      'INSERT INTO favorites (place_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.placeId, req.user.id]
    );
    respond.success(res, null, 'Tempat ditambahkan ke favorit.', 201);
  } catch (err) { next(err); }
};

// ── DELETE /api/favorites/:placeId [auth] ───────────────────────
const remove = async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM favorites WHERE place_id=$1 AND user_id=$2',
      [req.params.placeId, req.user.id]
    );
    respond.success(res, null, 'Tempat dihapus dari favorit.');
  } catch (err) { next(err); }
};

// ── GET /api/favorites/check/:placeId [auth] ────────────────────
const check = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM favorites WHERE place_id=$1 AND user_id=$2',
      [req.params.placeId, req.user.id]
    );
    respond.success(res, { is_favorite: rows.length > 0 });
  } catch (err) { next(err); }
};

module.exports = { getAll, add, remove, check };
