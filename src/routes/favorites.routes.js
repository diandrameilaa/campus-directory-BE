const router = require('express').Router();
const ctrl   = require('../controllers/favorites.controller');
const { authenticate } = require('../middleware/auth');

router.get('/',                  authenticate, ctrl.getAll);
router.post('/:placeId',         authenticate, ctrl.add);
router.delete('/:placeId',       authenticate, ctrl.remove);
router.get('/check/:placeId',    authenticate, ctrl.check);

module.exports = router;
