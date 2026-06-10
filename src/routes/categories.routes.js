const router   = require('express').Router();
const ctrl     = require('../controllers/categories.controller');
const { authenticate, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/',   authenticate, adminOnly, ctrl.rules, validate, ctrl.create);
router.put('/:id', authenticate, adminOnly, ctrl.rules, validate, ctrl.update);
router.delete('/:id', authenticate, adminOnly, ctrl.remove);

module.exports = router;
