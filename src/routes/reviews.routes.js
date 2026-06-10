const router   = require('express').Router();
const ctrl     = require('../controllers/reviews.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.put('/:id',    authenticate, ctrl.rules, validate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
