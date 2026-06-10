const db      = require('../config/db');
const respond = require('../utils/response');

// ── GET /api/admin/stats ─────────────────────────────────────────
const stats = async (req, res, next) => {
  try {
    const [places, users, reviews, categories] = await Promise.all([
      db.query('SELECT COUNT(*) FROM places WHERE is_active=TRUE'),
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM reviews'),
      db.query('SELECT COUNT(*) FROM categories'),
    ]);

    const topRated = await db.query(`
      SELECT p.id, p.name, p.rating, p.review_count, c.name AS category
      FROM places p JOIN categories c ON c.id=p.category_id
      WHERE p.is_active=TRUE ORDER BY p.rating DESC, p.review_count DESC LIMIT 5
    `);

    const recentPlaces = await db.query(`
      SELECT p.id, p.name, p.created_at, c.name AS category
      FROM places p JOIN categories c ON c.id=p.category_id
      ORDER BY p.created_at DESC LIMIT 5
    `);

    respond.success(res, {
      counts: {
        places:     parseInt(places.rows[0].count),
        users:      parseInt(users.rows[0].count),
        reviews:    parseInt(reviews.rows[0].count),
        categories: parseInt(categories.rows[0].count),
      },
      top_rated:     topRated.rows,
      recent_places: recentPlaces.rows,
    });
  } catch (err) { next(err); }
};

// ── GET /api/admin/users ─────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const where  = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(parseInt(limit), offset);

    const [{ rows }, { rows: cnt }] = await Promise.all([
      db.query(
        `SELECT id, name, email, role, is_active, created_at
         FROM users ${whereSQL}
         ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
        params
      ),
      db.query(`SELECT COUNT(*) FROM users ${whereSQL}`, params.slice(0,-2)),
    ]);

    respond.paginated(res, rows, {
      total: parseInt(cnt[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(parseInt(cnt[0].count) / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/role [admin] ────────────────────────
const setRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user','admin'].includes(role))
      return respond.error(res, "Role harus 'user' atau 'admin'.", 400);
    if (parseInt(req.params.id) === req.user.id)
      return respond.error(res, 'Tidak dapat mengubah role diri sendiri.', 400);

    const { rows } = await db.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    if (!rows.length) return respond.error(res, 'User tidak ditemukan.', 404);
    respond.success(res, rows[0], 'Role berhasil diubah.');
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/toggle [admin] ──────────────────────
const toggleActive = async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return respond.error(res, 'Tidak dapat menonaktifkan akun sendiri.', 400);

    const { rows } = await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE id=$1 RETURNING id, name, is_active',
      [req.params.id]
    );
    if (!rows.length) return respond.error(res, 'User tidak ditemukan.', 404);
    const msg = rows[0].is_active ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.';
    respond.success(res, rows[0], msg);
  } catch (err) { next(err); }
};

// ── GET /api/admin/places ─────────────────────────────────────────
// Daftar semua tempat termasuk yang non-aktif
const getPlaces = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where  = active !== undefined ? `WHERE p.is_active=${active === 'true'}` : '';

    const [{ rows }, { rows: cnt }] = await Promise.all([
      db.query(
        `SELECT p.id, p.name, p.lat, p.lng, p.rating, p.review_count,
                p.is_active, p.is_verified, p.created_at,
                c.name AS category
         FROM places p JOIN categories c ON c.id=p.category_id
         ${where}
         ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*) FROM places p ${where}`),
    ]);

    respond.paginated(res, rows, {
      total: parseInt(cnt[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(parseInt(cnt[0].count) / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/places/:id/verify [admin] ─────────────────────
const verifyPlace = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE places SET is_verified = NOT is_verified WHERE id=$1 RETURNING id, name, is_verified',
      [req.params.id]
    );
    if (!rows.length) return respond.error(res, 'Tempat tidak ditemukan.', 404);
    const msg = rows[0].is_verified ? 'Tempat berhasil diverifikasi.' : 'Verifikasi dicabut.';
    respond.success(res, rows[0], msg);
  } catch (err) { next(err); }
};

module.exports = { stats, getUsers, setRole, toggleActive, getPlaces, verifyPlace };
