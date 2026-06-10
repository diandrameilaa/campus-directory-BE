const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const { authenticate, adminOnly } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

// Semua admin route butuh authenticate + adminOnly
router.use(authenticate, adminOnly);

router.get('/stats',                ctrl.stats);
router.get('/users',                ctrl.getUsers);
router.put('/users/:id/role',       [body('role').notEmpty()], validate, ctrl.setRole);
router.put('/users/:id/toggle',     ctrl.toggleActive);
router.get('/places',               ctrl.getPlaces);
router.put('/places/:id/verify',    ctrl.verifyPlace);

module.exports = router;
