const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body } = require('express-validator');
const db      = require('../config/db');
const respond = require('../utils/response');

// ── Helper ──────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── Validation rules (exported for route) ───────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Nama wajib diisi'),
  body('email').isEmail().normalizeEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Email tidak valid'),
  body('password').notEmpty().withMessage('Password wajib diisi'),
];

// ── POST /api/auth/register ─────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const exist = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exist.rows.length) return respond.error(res, 'Email sudah terdaftar.', 409);

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash]
    );

    respond.success(res, { user: rows[0], token: signToken(rows[0]) }, 'Registrasi berhasil.', 201);
  } catch (err) { next(err); }
};

// ── POST /api/auth/login ────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email=$1',
      [email]
    );
    if (!rows.length) return respond.error(res, 'Email atau password salah.', 401);

    const user = rows[0];
    if (!user.is_active) return respond.error(res, 'Akun telah dinonaktifkan.', 403);

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return respond.error(res, 'Email atau password salah.', 401);

    delete user.password_hash;
    delete user.is_active;

    respond.success(res, { user, token: signToken(user) }, 'Login berhasil.');
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ────────────────────────────────────────────
const me = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id=$1 AND is_active=TRUE',
      [req.user.id]
    );
    if (!rows.length) return respond.error(res, 'User tidak ditemukan.', 404);
    respond.success(res, rows[0]);
  } catch (err) { next(err); }
};

// ── PUT /api/auth/me ─── update profile ────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const avatar_url = req.file
      ? `/uploads/${req.file.filename}`
      : undefined;

    const sets   = [];
    const params = [];

    if (name)       { params.push(name);       sets.push(`name=$${params.length}`); }
    if (avatar_url) { params.push(avatar_url); sets.push(`avatar_url=$${params.length}`); }

    if (!sets.length) return respond.error(res, 'Tidak ada field yang diperbarui.', 400);

    params.push(req.user.id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${params.length}
       RETURNING id, name, email, role, avatar_url`,
      params
    );
    respond.success(res, rows[0], 'Profil berhasil diperbarui.');
  } catch (err) { next(err); }
};

// ── PUT /api/auth/change-password ───────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id=$1', [req.user.id]
    );
    const ok = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!ok) return respond.error(res, 'Password lama salah.', 401);

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);

    respond.success(res, null, 'Password berhasil diubah.');
  } catch (err) { next(err); }
};

module.exports = { register, login, me, updateProfile, changePassword, registerRules, loginRules };
