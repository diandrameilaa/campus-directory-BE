require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const logger     = require('./utils/logger');
const { notFound, globalError } = require('./middleware/errorHandler');

// ── Routes ──────────────────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const placesRoutes     = require('./routes/places.routes');
const categoriesRoutes = require('./routes/categories.routes');
const reviewsRoutes    = require('./routes/reviews.routes');
const favoritesRoutes  = require('./routes/favorites.routes');
const adminRoutes      = require('./routes/admin.routes');

// ── Init DB (connect & validate) ────────────────────────────────
const db = require('./config/db');

const app = express();

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // izinkan serve gambar ke app
}));
app.use(compression());
app.use(cors({
  origin: '*', // Batasi ke domain kamu di production jika perlu
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parser ──────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Logger ──────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health', // skip health checks
}));

// ── Rate Limiter ──────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX        || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { status: 'error', message: 'Terlalu banyak request, coba lagi nanti.' },
});
app.use('/api/', limiter);

// ── Static Files (uploaded images) ───────────────────────────────
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// ── Health Check ──────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:  'ok',
  service: 'Campus Directory API',
  version: '1.0.0',
  uptime:  Math.floor(process.uptime()),
  time:    new Date().toISOString(),
}));

// ── API Info ──────────────────────────────────────────────────────
app.get('/api', (req, res) => res.json({
  message: 'Campus Directory REST API',
  version: '1.0.0',
  endpoints: {
    auth: {
      'POST /api/auth/register':       'Daftar akun baru',
      'POST /api/auth/login':          'Login, dapatkan JWT token',
      'GET  /api/auth/me':             'Info user yang login [auth]',
      'PUT  /api/auth/me':             'Update profil [auth]',
      'PUT  /api/auth/change-password':'Ganti password [auth]',
    },
    places: {
      'GET  /api/places':              'Daftar tempat (filter: category, search, lat, lng, radius, tags, sort, page, limit)',
      'GET  /api/places/nearby':       'Tempat terdekat (wajib: lat, lng | opsional: radius, category, limit)',
      'GET  /api/places/:id':          'Detail satu tempat (opsional: lat, lng untuk jarak)',
      'POST /api/places':              'Tambah tempat [admin]',
      'PUT  /api/places/:id':          'Edit tempat [admin]',
      'DELETE /api/places/:id':        'Hapus tempat (soft delete) [admin]',
      'GET  /api/places/:id/photos':   'Daftar foto tempat',
      'POST /api/places/:id/photos':   'Tambah foto [admin]',
    },
    reviews: {
      'GET  /api/places/:id/reviews':         'Daftar ulasan tempat (page, limit)',
      'GET  /api/places/:id/reviews/summary': 'Ringkasan rating tempat',
      'POST /api/places/:id/reviews':         'Tulis ulasan [auth]',
      'PUT  /api/reviews/:id':                'Edit ulasan [owner/admin]',
      'DELETE /api/reviews/:id':              'Hapus ulasan [owner/admin]',
    },
    categories: {
      'GET  /api/categories':       'Daftar kategori (+ jumlah tempat)',
      'GET  /api/categories/:id':   'Detail kategori',
      'POST /api/categories':       'Tambah kategori [admin]',
      'PUT  /api/categories/:id':   'Edit kategori [admin]',
      'DELETE /api/categories/:id': 'Hapus kategori [admin]',
    },
    favorites: {
      'GET    /api/favorites':               'Daftar favorit saya [auth]',
      'POST   /api/favorites/:placeId':      'Tambah ke favorit [auth]',
      'DELETE /api/favorites/:placeId':      'Hapus dari favorit [auth]',
      'GET    /api/favorites/check/:placeId':'Cek apakah difavoritkan [auth]',
    },
    admin: {
      'GET /api/admin/stats':              'Dashboard statistik [admin]',
      'GET /api/admin/users':              'Daftar semua user [admin]',
      'PUT /api/admin/users/:id/role':     'Ubah role user [admin]',
      'PUT /api/admin/users/:id/toggle':   'Aktif/nonaktif user [admin]',
      'GET /api/admin/places':             'Semua tempat termasuk nonaktif [admin]',
      'PUT /api/admin/places/:id/verify':  'Verifikasi/batalkan verifikasi tempat [admin]',
    },
  },
}));

// ── Mount Routes ──────────────────────────────────────────────────
app.use('/api/auth',       authRoutes.router ?? authRoutes);
app.use('/api/places',     placesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/reviews',    reviewsRoutes);
app.use('/api/favorites',  favoritesRoutes);
app.use('/api/admin',      adminRoutes);

// ── Error Handlers (harus paling bawah) ──────────────────────────
app.use(notFound);
app.use(globalError);

// ── Start Server ──────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
if (require.main === module) {
  db.ready
    .then(() => {
      app.listen(PORT, () => {
        logger.info(`Campus Directory API berjalan di port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
        logger.info(`API docs: http://localhost:${PORT}/api`);
        logger.info(`Health : http://localhost:${PORT}/health`);
      });
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = app;
