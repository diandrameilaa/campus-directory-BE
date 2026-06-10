const logger  = require('../utils/logger');
const respond = require('../utils/response');

const notFound = (req, res) =>
  respond.error(res, `Route '${req.originalUrl}' tidak ditemukan.`, 404);

// eslint-disable-next-line no-unused-vars
const globalError = (err, req, res, next) => {
  logger.error(err);
  if (err.code === '23505') return respond.error(res, 'Data sudah ada (duplicate).', 409);
  if (err.code === '23503') return respond.error(res, 'Referensi data tidak valid.', 400);
  if (err.code === '23514') return respond.error(res, 'Nilai tidak memenuhi constraint.', 400);
  const code    = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && code === 500
    ? 'Terjadi kesalahan pada server.'
    : err.message;
  respond.error(res, message, code);
};

module.exports = { notFound, globalError };
