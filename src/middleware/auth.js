const jwt    = require('jsonwebtoken');
const respond = require('../utils/response');

const authenticate = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer '))
    return respond.error(res, 'Token tidak ditemukan. Harap login terlebih dahulu.', 401);

  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    respond.error(res, 'Token tidak valid atau sudah kadaluarsa.', 401);
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return respond.error(res, 'Akses ditolak. Hanya admin yang diizinkan.', 403);
  next();
};

// Optional auth: attach user if token present but don't block
const optionalAuth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (header?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET); } catch {}
  }
  next();
};

module.exports = { authenticate, adminOnly, optionalAuth };
