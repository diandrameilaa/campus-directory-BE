const router   = require('express').Router();
const places   = require('../controllers/places.controller');
const reviews  = require('../controllers/reviews.controller');
const { authenticate, adminOnly, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload   = require('../middleware/upload');

// Public endpoints
router.get('/nearby',    places.nearby);
router.get('/',          optionalAuth, places.getAll);
router.get('/:id',       optionalAuth, places.getById);
router.get('/:id/reviews',         reviews.getByPlace);
router.get('/:id/reviews/summary', reviews.summary);
router.get('/:id/photos',          places.getPhotos);

// Auth required
router.post('/:id/reviews', authenticate, reviews.rules, validate, reviews.create);

// Admin only
router.post('/',   authenticate, adminOnly, upload.single('photo'), places.placeRules, validate, places.create);
router.put('/:id', authenticate, adminOnly, upload.single('photo'), places.placeRules, validate, places.update);
router.delete('/:id', authenticate, adminOnly, places.remove);
router.post('/:id/photos', authenticate, adminOnly, upload.single('photo'), places.addPhoto);

module.exports = router;
