# Campus Directory API — Backend Lengkap

REST API production-ready untuk proyek **Android Map Directory** (Cloud Computing).  
Stack: **Node.js + Express + PostgreSQL**

---

## Struktur Proyek

```
campus-directory-api/
├── src/
│   ├── index.js                        ← Entry point
│   ├── config/
│   │   ├── db.js                       ← PostgreSQL connection pool
│   │   └── migrate.js                  ← Jalankan schema SQL sekali
│   ├── controllers/
│   │   ├── auth.controller.js          ← Register, Login, Profil, Ganti password
│   │   ├── places.controller.js        ← CRUD + Nearby + Filter + Upload foto
│   │   ├── categories.controller.js    ← CRUD + jumlah tempat per kategori
│   │   ├── reviews.controller.js       ← CRUD + Summary rating
│   │   ├── favorites.controller.js     ← Tambah/hapus/cek favorit
│   │   └── admin.controller.js         ← Dashboard stats + user management
│   ├── middleware/
│   │   ├── auth.js                     ← JWT verify, adminOnly, optionalAuth
│   │   ├── validate.js                 ← express-validator helper
│   │   ├── upload.js                   ← Multer (upload gambar)
│   │   └── errorHandler.js             ← 404 + global error handler
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── places.routes.js
│   │   ├── categories.routes.js
│   │   ├── reviews.routes.js
│   │   ├── favorites.routes.js
│   │   └── admin.routes.js
│   └── utils/
│       ├── logger.js                   ← Winston logger
│       ├── response.js                 ← Standardised JSON response
│       └── haversine.js                ← Kalkulasi jarak GPS
├── sql/
│   └── schema.sql                      ← DDL + trigger + 30 seed tempat
├── logs/                               ← Auto-created
├── uploads/                            ← Auto-created (file gambar)
├── .env.example
├── .gitignore
├── Procfile
└── package.json
```

---

## Setup Lokal

### 1. Clone & install
```bash
git clone <repo>
cd campus-directory-api
npm install
```

### 2. Buat database & jalankan schema
```bash
psql -U postgres -c "CREATE DATABASE campus_directory;"
psql -U postgres -d campus_directory -f sql/schema.sql
```
Atau pakai migration script:
```bash
cp .env.example .env   # isi dulu DB_* nya
npm run db:migrate
```

### 3. Konfigurasi `.env`
```bash
cp .env.example .env
# Edit sesuai konfigurasi lokal
```

### 4. Jalankan
```bash
npm run dev   # development (nodemon)
npm start     # production
```

Server: `http://localhost:3000`  
Docs:   `http://localhost:3000/api`  
Health: `http://localhost:3000/health`

---

## Endpoint Lengkap

### Auth
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| POST | /api/auth/register | - | Daftar akun baru |
| POST | /api/auth/login | - | Login → dapat JWT token |
| GET | /api/auth/me | Bearer | Info user yang login |
| PUT | /api/auth/me | Bearer | Update nama / avatar |
| PUT | /api/auth/change-password | Bearer | Ganti password |

### Places
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | /api/places | - | Daftar tempat |
| GET | /api/places/nearby | - | Tempat terdekat (wajib: lat, lng) |
| GET | /api/places/:id | - | Detail tempat |
| POST | /api/places | Admin | Tambah tempat (+ upload foto) |
| PUT | /api/places/:id | Admin | Edit tempat |
| DELETE | /api/places/:id | Admin | Soft delete |
| GET | /api/places/:id/photos | - | Semua foto |
| POST | /api/places/:id/photos | Admin | Tambah foto |

#### Query params `GET /api/places`
| Param | Contoh | Keterangan |
|---|---|---|
| category | ?category=1 | Filter by category ID |
| search | ?search=kafe | Cari nama/deskripsi/alamat |
| lat, lng | ?lat=-7.55&lng=112.22 | Lokasi user (aktifkan jarak) |
| radius | ?radius=1.5 | Radius km (butuh lat, lng) |
| tags | ?tags=wifi,ac | Filter by tags (overlap) |
| sort | ?sort=distance | distance / rating / name |
| page, limit | ?page=1&limit=20 | Paginasi |

### Reviews
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | /api/places/:id/reviews | - | Daftar ulasan (paginasi) |
| GET | /api/places/:id/reviews/summary | - | Ringkasan rating (1–5 bintang) |
| POST | /api/places/:id/reviews | Bearer | Tulis ulasan |
| PUT | /api/reviews/:id | Bearer | Edit ulasan (owner/admin) |
| DELETE | /api/reviews/:id | Bearer | Hapus ulasan (owner/admin) |

### Categories
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | /api/categories | - | Daftar + jumlah tempat per kategori |
| GET | /api/categories/:id | - | Detail |
| POST | /api/categories | Admin | Tambah |
| PUT | /api/categories/:id | Admin | Edit |
| DELETE | /api/categories/:id | Admin | Hapus (gagal jika masih dipakai) |

### Favorites
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | /api/favorites | Bearer | Favorit saya |
| POST | /api/favorites/:placeId | Bearer | Tambah favorit |
| DELETE | /api/favorites/:placeId | Bearer | Hapus favorit |
| GET | /api/favorites/check/:placeId | Bearer | Cek apakah difavoritkan |

### Admin
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | /api/admin/stats | Admin | Statistik: jumlah tempat, user, review |
| GET | /api/admin/users | Admin | Daftar semua user |
| PUT | /api/admin/users/:id/role | Admin | Ubah role user |
| PUT | /api/admin/users/:id/toggle | Admin | Aktif/nonaktifkan akun |
| GET | /api/admin/places | Admin | Semua tempat termasuk nonaktif |
| PUT | /api/admin/places/:id/verify | Admin | Verifikasi tempat |

---

## Format Response

**Success:**
```json
{
  "status": "success",
  "message": "OK",
  "data": { ... }
}
```

**Paginated:**
```json
{
  "status": "success",
  "data": [ ... ],
  "meta": { "total": 30, "page": 1, "limit": 20, "pages": 2 }
}
```

**Error:**
```json
{
  "status": "error",
  "message": "Deskripsi error",
  "errors": [ ... ]   // opsional, untuk validasi
}
```

---

## Akun Admin Default
```
Email:    admin@campus.ac.id
Password: Admin@123
```
Ganti password setelah pertama login via `PUT /api/auth/change-password`.

---

## Deploy ke Railway (Free Tier)

```bash
# 1. Push ke GitHub
git init && git add . && git commit -m "init"
git remote add origin <github-url>
git push -u origin main

# 2. Di railway.app:
#    New Project → Deploy from GitHub → pilih repo
#    Add Service → Database → PostgreSQL

# 3. Set environment variables (dari .env.example)
#    Salin DATABASE_URL dari Railway ke DB_* vars
#    atau set DB_SSL=true dan gunakan DATABASE_URL langsung

# 4. Jalankan schema (Railway Shell):
psql $DATABASE_URL -f sql/schema.sql
```

### Platform alternatif gratis
| Platform | Keterangan |
|---|---|
| **Render.com** | Web Service + PostgreSQL, free tier |
| **Supabase** | PostgreSQL hosted + REST API bawaan |
| **Neon.tech** | Serverless PostgreSQL |
| **Fly.io** | Docker-based, free tier |

---

## Keamanan

- Password di-hash dengan **bcrypt** (12 rounds)
- Auth via **JWT Bearer Token** (7 hari)
- **Rate limiting**: 100 req / 15 menit per IP
- **Helmet.js**: security headers
- **Soft delete**: data tidak hilang permanen
- **Credential** tidak pernah ada di app Android
- Upload file: validasi ekstensi + ukuran maks 5MB
- Input: disanitasi via express-validator di semua endpoint

---

## Koneksi dari Android (Flutter)

```dart
// Ganti base URL setelah deploy
static const String baseUrl = 'https://your-app.railway.app/api';

// Contoh hit nearby
final response = await dio.get('/places/nearby', queryParameters: {
  'lat': userLat,
  'lng': userLng,
  'radius': 1.5,
  'sort': 'distance',
});
```
