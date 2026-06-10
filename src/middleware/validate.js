const { validationResult } = require('express-validator');
const respond = require('../utils/response');

module.exports = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty())
    return respond.error(res, 'Validasi gagal', 422, errs.array());
  next();
};
