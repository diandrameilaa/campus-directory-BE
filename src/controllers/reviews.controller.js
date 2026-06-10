const { body } = require('express-validator');
const db      = require('../config/db');
const respond = require('../utils/response');

const rules = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating harus 1–5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Komentar maks 1000 karakter'),
];

// ── GET /api/places/:id/reviews ─────────────────────────────────
const getByPlace = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ rows }, { rows: cnt }] = await Promise.all([
      db.query(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                u.id AS user_id, u.name AS user_name, u.avatar_url
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.place_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.id, parseInt(limit), offset]
      ),
      db.query('SELECT COUNT(*) FROM reviews WHERE place_id=$1', [req.params.id]),
    ]);

    const total = parseInt(cnt[0].count);
    respond.paginated(res, rows, {
      total, page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

// ── GET /api/places/:id/reviews/summary ─────────────────────────
const summary = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
         COUNT(*)::INT AS total,
         COUNT(*) FILTER (WHERE rating=5)::INT AS five,
         COUNT(*) FILTER (WHERE rating=4)::INT AS four,
         COUNT(*) FILTER (WHERE rating=3)::INT AS three,
         COUNT(*) FILTER (WHERE rating=2)::INT AS two,
         COUNT(*) FILTER (WHERE rating=1)::INT AS one
       FROM reviews WHERE place_id=$1`,
      [req.params.id]
    );
    respond.success(res, rows[0]);
  } catch (err) { next(err); }
};

// ── POST /api/places/:id/reviews [auth] ─────────────────────────
const create = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const { rows } = await db.query(
      `INSERT INTO reviews (place_id, user_id, rating, comment)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.id, rating, comment || null]
    );
    respond.success(res, rows[0], 'Ulasan berhasil ditambahkan.', 201);
  } catch (err) {
    if (err.code === '23505') return respond.error(res, 'Kamu sudah pernah memberi ulasan untuk tempat ini.', 409);
    if (err.code === '23503') return respond.error(res, 'Tempat tidak ditemukan.', 404);
    next(err);
  }
};

// ── PUT /api/reviews/:id [owner] ────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const { rows: existing } = await db.query(
      'SELECT user_id FROM reviews WHERE id=$1', [req.params.id]
    );
    if (!existing.length) return respond.error(res, 'Ulasan tidak ditemukan.', 404);
    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin')
      return respond.error(res, 'Tidak diizinkan mengedit ulasan ini.', 403);

    const { rows } = await db.query(
      'UPDATE reviews SET rating=$1, comment=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [rating, comment, req.params.id]
    );
    respond.success(res, rows[0], 'Ulasan berhasil diperbarui.');
  } catch (err) { next(err); }
};

// ── DELETE /api/reviews/:id [owner | admin] ─────────────────────
const remove = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM reviews WHERE id=$1', [req.params.id]);
    if (!rows.length) return respond.error(res, 'Ulasan tidak ditemukan.', 404);
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin')
      return respond.error(res, 'Tidak diizinkan menghapus ulasan ini.', 403);

    await db.query('DELETE FROM reviews WHERE id=$1', [req.params.id]);
    respond.success(res, null, 'Ulasan berhasil dihapus.');
  } catch (err) { next(err); }
};

module.exports = { getByPlace, summary, create, update, remove, rules };
