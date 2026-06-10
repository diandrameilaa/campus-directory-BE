const { body } = require('express-validator');
const db       = require('../config/db');
const respond  = require('../utils/response');

// ── Validation rules ────────────────────────────────────────────
const rules = [
  body('name').trim().notEmpty().withMessage('Nama kategori wajib diisi'),
  body('icon').optional().trim(),
  body('color').optional().trim(),
];

// ── GET /api/categories ─────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.name, c.icon, c.color,
             COUNT(p.id)::INT AS place_count
      FROM categories c
      LEFT JOIN places p ON p.category_id = c.id AND p.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    respond.success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /api/categories/:id ─────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, icon, color FROM categories WHERE id=$1',
      [req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Kategori tidak ditemukan.', 404);
    respond.success(res, rows[0]);
  } catch (err) { next(err); }
};

// ── POST /api/categories [admin] ────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { name, icon, color } = req.body;
    const { rows } = await db.query(
      'INSERT INTO categories (name, icon, color) VALUES ($1,$2,$3) RETURNING *',
      [name, icon, color]
    );
    respond.success(res, rows[0], 'Kategori berhasil dibuat.', 201);
  } catch (err) { next(err); }
};

// ── PUT /api/categories/:id [admin] ─────────────────────────────
const update = async (req, res, next) => {
  try {
    const { name, icon, color } = req.body;
    const { rows } = await db.query(
      'UPDATE categories SET name=$1, icon=$2, color=$3 WHERE id=$4 RETURNING *',
      [name, icon, color, req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Kategori tidak ditemukan.', 404);
    respond.success(res, rows[0], 'Kategori berhasil diupdate.');
  } catch (err) { next(err); }
};

// ── DELETE /api/categories/:id [admin] ──────────────────────────
const remove = async (req, res, next) => {
  try {
    // Cek apakah masih ada tempat yang pakai kategori ini
    const used = await db.query(
      'SELECT COUNT(*) FROM places WHERE category_id=$1 AND is_active=TRUE',
      [req.params.id]
    );
    if (parseInt(used.rows[0].count) > 0)
      return respond.error(res, 'Kategori masih digunakan oleh tempat yang aktif.', 409);

    const { rowCount } = await db.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return respond.error(res, 'Kategori tidak ditemukan.', 404);
    respond.success(res, null, 'Kategori berhasil dihapus.');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, rules };
