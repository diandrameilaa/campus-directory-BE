// ================================================================
// routes/auth.routes.js
// ================================================================
const r1   = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload   = require('../middleware/upload');
const { body } = require('express-validator');

r1.post('/register', ctrl.registerRules, validate, ctrl.register);
r1.post('/login',    ctrl.loginRules,    validate, ctrl.login);
r1.get('/me',        authenticate, ctrl.me);
r1.put('/me',        authenticate, upload.single('avatar'), ctrl.updateProfile);
r1.put('/change-password', authenticate, [
  body('old_password').notEmpty().withMessage('Password lama wajib diisi'),
  body('new_password').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
], validate, ctrl.changePassword);

module.exports = { path: '/api/auth', router: r1 };
