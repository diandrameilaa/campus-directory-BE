const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Hanya file gambar yang diizinkan (jpg, jpeg, png, webp)'));
};

const maxMB   = parseInt(process.env.MAX_FILE_SIZE_MB || '5');
const upload  = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxMB * 1024 * 1024 },
});

module.exports = upload;
