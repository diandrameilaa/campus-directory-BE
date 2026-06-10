-- ================================================================
-- CAMPUS DIRECTORY — PostgreSQL Schema v1.0
-- Run: psql -U postgres -d campus_directory -f sql/schema.sql
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── CATEGORIES ──────────────────────────────────────────────────
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS reviews   CASCADE;
DROP TABLE IF EXISTS places    CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users     CASCADE;

CREATE TABLE categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    icon       VARCHAR(100),
    color      VARCHAR(20) DEFAULT '#2196F3',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','admin')),
    avatar_url    TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PLACES ───────────────────────────────────────────────────────
CREATE TABLE places (
    id            SERIAL PRIMARY KEY,
    category_id   INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name          VARCHAR(200) NOT NULL,
    address       TEXT,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    description   TEXT,
    phone         VARCHAR(50),
    open_hours    VARCHAR(150),
    website       TEXT,
    photo_url     TEXT,
    photos        TEXT[],               -- multiple photos
    tags          TEXT[],               -- e.g. {wifi,ac,parkir}
    price_range   VARCHAR(50),          -- e.g. 'Rp5K–15K'
    rating        NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count  INT DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    is_verified   BOOLEAN DEFAULT FALSE,
    created_by    INT REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_places_category ON places(category_id);
CREATE INDEX idx_places_location ON places USING GIST (
    point(lng, lat) point_ops
) WHERE is_active = TRUE;
CREATE INDEX idx_places_active   ON places(is_active);
CREATE INDEX idx_places_rating   ON places(rating DESC);

-- ── REVIEWS ──────────────────────────────────────────────────────
CREATE TABLE reviews (
    id         SERIAL PRIMARY KEY,
    place_id   INT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    rating     INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (place_id, user_id)
);

CREATE INDEX idx_reviews_place ON reviews(place_id);
CREATE INDEX idx_reviews_user  ON reviews(user_id);

-- ── FAVORITES ────────────────────────────────────────────────────
CREATE TABLE favorites (
    id         SERIAL PRIMARY KEY,
    place_id   INT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (place_id, user_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- ── TRIGGER: auto-update rating ─────────────────────────────────
CREATE OR REPLACE FUNCTION sync_place_rating()
RETURNS TRIGGER AS $$
DECLARE
    pid INT;
BEGIN
    pid := COALESCE(NEW.place_id, OLD.place_id);
    UPDATE places
    SET
        rating       = COALESCE((SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews WHERE place_id = pid), 0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE place_id = pid),
        updated_at   = NOW()
    WHERE id = pid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION sync_place_rating();

-- ── TRIGGER: update users.updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_places_updated
BEFORE UPDATE ON places
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ================================================================
-- SEED DATA
-- ================================================================

INSERT INTO categories (name, icon, color) VALUES
    ('Cafe',             'coffee',       '#F59E0B'),
    ('Kantin',           'utensils',     '#10B981'),
    ('Fotokopi & Print', 'copy',         '#6366F1'),
    ('ATM & Bank',       'credit-card',  '#3B82F6'),
    ('Parkir',           'parking',      '#8B5CF6'),
    ('Kos & Kontrakan',  'home',         '#EC4899'),
    ('Minimarket',       'shopping-bag', '#14B8A6'),
    ('Layanan Kampus',   'building',     '#F97316'),
    ('Kesehatan',        'heart',        '#EF4444'),
    ('Laundry',          'wind',         '#06B6D4');

-- Admin user default (password: Admin@123)
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Admin Campus', 'admin@campus.ac.id',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewKpRkBFpCvqGppa',
     'admin');

-- 30 tempat dengan koordinat variasi (sekitar lat -7.556, lng 112.228)
INSERT INTO places (category_id, name, address, lat, lng, description, phone, open_hours, price_range, tags, photo_url, is_verified) VALUES
-- CAFE (cat 1)
(1, 'Kafe Literasi',        'Jl. Kampus Raya No.1',    -7.5558, 112.2278, 'Kafe nyaman dengan koleksi buku, wifi kencang, dan colokan di setiap meja. Cocok untuk ngerjain tugas atau skripsi.',  '081234000001', 'Senin–Minggu 08.00–23.00', 'Rp15K–35K', ARRAY['wifi','ac','colokan','non-smoking'], 'https://picsum.photos/seed/cafe1/400/300', TRUE),
(1, 'Warung Kopi Ngudi',    'Jl. Semeru No.5',         -7.5565, 112.2275, 'Kopi robusta asli Jawa Timur dengan harga mahasiswa. Suasana tradisional dan santai.',                            '081234000002', 'Setiap hari 06.00–24.00',  'Rp5K–15K',  ARRAY['wifi','parkir'],           'https://picsum.photos/seed/cafe2/400/300', TRUE),
(1, 'Cafe Cozy Corner',     'Jl. Veteran No.10',       -7.5545, 112.2265, 'Interior estetik dengan pencahayaan hangat. Tersedia meeting room kecil untuk diskusi kelompok.',                  '081234000003', 'Senin–Sabtu 09.00–22.00',  'Rp20K–50K', ARRAY['wifi','ac','meeting-room'], 'https://picsum.photos/seed/cafe3/400/300', TRUE),
(1, 'Kopi Kenangan Kampus', 'Depan Gerbang Utama',     -7.5540, 112.2270, 'Gerai kopi kekinian dengan menu bervariasi. Antrian cepat, cocok untuk beli sebelum kuliah.',                     '081234000004', 'Setiap hari 07.00–21.00',  'Rp18K–35K', ARRAY['takeaway'],                'https://picsum.photos/seed/cafe4/400/300', FALSE),
(1, 'Kedai Santuy',         'Jl. Mastrip No.15',       -7.5572, 112.2295, 'Tempat nongkrong favorit mahasiswa tingkat akhir. Ada kolam ikan kecil dan area outdoor.',                         '081234000005', 'Setiap hari 10.00–01.00',  'Rp10K–25K', ARRAY['wifi','outdoor','parkir'],  'https://picsum.photos/seed/cafe5/400/300', FALSE),

-- KANTIN (cat 2)
(2, 'Kantin Pusat (Gedung A)',   'Gedung A Lt.1',       -7.5558, 112.2285, 'Kantin terbesar kampus. Ada 12 stand makanan: nasi, mie, bakso, gado-gado, dan minuman segar.',                  NULL,           'Senin–Jumat 07.00–16.00',  'Rp8K–20K',  ARRAY['halal','parkir'],          'https://picsum.photos/seed/kantin1/400/300', TRUE),
(2, 'Kantin Teknik',             'Gedung T Lt.1',       -7.5570, 112.2290, 'Kantin khusus area teknik. Menu sederhana tapi porsi besar. Harga bersahabat untuk mahasiswa.',                  NULL,           'Senin–Jumat 07.30–15.00',  'Rp7K–15K',  ARRAY['halal'],                   'https://picsum.photos/seed/kantin2/400/300', TRUE),
(2, 'Warung Bu Yati',            'Belakang Gedung B',   -7.5562, 112.2282, 'Warung legendaris yang sudah berdiri 15 tahun. Spesialis nasi rames dan lauk komplit.',                          '081234000008', 'Senin–Sabtu 06.30–14.00',  'Rp8K–18K',  ARRAY['halal','murah'],           'https://picsum.photos/seed/kantin3/400/300', TRUE),
(2, 'Food Court Pascasarjana',   'Gedung PPS Lt.1',     -7.5550, 112.2280, 'Food court bersih dengan 8 tenant. Pilihan lebih variatif termasuk western food dan minuman boba.',              NULL,           'Senin–Jumat 08.00–17.00',  'Rp12K–30K', ARRAY['halal','ac'],              'https://picsum.photos/seed/kantin4/400/300', FALSE),

-- FOTOKOPI (cat 3)
(3, 'Fotokopi Berkah',           'Jl. Kampus No.3',     -7.5555, 112.2278, 'Fotokopi, print warna/hitam putih, jilid, laminating, dan scan. Pelayanan cepat.',                              '081234000010', 'Setiap hari 07.00–21.00',  'Rp300–2K/lbr', ARRAY['print-warna','jilid','scan'], 'https://picsum.photos/seed/foto1/400/300', TRUE),
(3, 'Print & Copy Mandiri',      'Jl. Semeru No.2',     -7.5568, 112.2272, 'Layanan print 24 jam dengan self-service. Tersedia print A3, banner, dan undangan.',                            '081234000011', '24 Jam',                   'Rp500–5K/lbr', ARRAY['24jam','a3','banner'],         'https://picsum.photos/seed/foto2/400/300', TRUE),
(3, 'Kios Print Kampus',         'Dekat Perpustakaan',  -7.5548, 112.2283, 'Strategis dekat perpus. Harga paling murah. Print skripsi, proposal, dan makalah.',                             '081234000012', 'Senin–Sabtu 07.00–20.00',  'Rp250–1K/lbr', ARRAY['murah','jilid-hard'],          'https://picsum.photos/seed/foto3/400/300', FALSE),

-- ATM (cat 4)
(4, 'ATM BRI',       'Depan Rektorat',       -7.5562, 112.2283, 'ATM BRI 24 jam. Setor tunai tersedia. Jarang antre.',                    NULL, '24 Jam', NULL, ARRAY['24jam','setor-tunai'],  'https://picsum.photos/seed/atm1/400/300', TRUE),
(4, 'ATM BNI',       'Gedung B Lobby',        -7.5568, 112.2288, 'ATM BNI 24 jam dengan fitur tarik tunai dan cek saldo.',               NULL, '24 Jam', NULL, ARRAY['24jam'],                'https://picsum.photos/seed/atm2/400/300', TRUE),
(4, 'ATM Mandiri',   'Dekat Koperasi',        -7.5552, 112.2276, 'ATM Mandiri dan e-money reload. Ada mesin EDC untuk transfer.',         NULL, '24 Jam', NULL, ARRAY['24jam','emoney'],       'https://picsum.photos/seed/atm3/400/300', TRUE),
(4, 'ATM BCA',       'Jl. Kampus Raya No.8', -7.5544, 112.2268, 'ATM BCA di minimarket. Juga tersedia QRIS dan tarik tunai GoPay.',      NULL, '06.00–24.00', NULL, ARRAY['qris'],           'https://picsum.photos/seed/atm4/400/300', FALSE),

-- PARKIR (cat 5)
(5, 'Parkir Rektorat',    'Depan Rektorat',       -7.5560, 112.2281, 'Parkir motor dan mobil. Dijaga 24 jam. Tarif flat per hari.',          NULL, '24 Jam', 'Rp2K–5K', ARRAY['motor','mobil','24jam','jaga'],    NULL, TRUE),
(5, 'Parkir Gedung A',    'Samping Gedung A',      -7.5556, 112.2286, 'Kapasitas besar. Khusus sivitas kampus. Gratis dengan KTM.',          NULL, '06.00–22.00', 'Gratis (KTM)', ARRAY['motor','gratis-ktm'],        NULL, TRUE),
(5, 'Parkir Indomaret',   'Jl. Mastrip No.2',      -7.5550, 112.2270, 'Parkir umum di area minimarket. Tidak dijaga, pakai kamera CCTV.',   NULL, '06.00–24.00', 'Gratis', ARRAY['motor','mobil','cctv'],          NULL, FALSE),

-- KOS (cat 6)
(6, 'Kos Putri Melati',   'Jl. Melati No.5',       -7.5580, 112.2260, 'Kos putri 2 lantai, 20 kamar. Fasilitas: wifi, AC, kamar mandi dalam, dapur bersama.',  '081234000019', NULL, 'Rp500K–800K/bln', ARRAY['wifi','ac','km-dalam','putri'],   NULL, TRUE),
(6, 'Kos Putra Maju',     'Jl. Kenanga No.3',      -7.5575, 112.2255, 'Kos putra sederhana dan bersih. Dekat warung makan. Bebas masuk 24 jam.',               '081234000020', NULL, 'Rp350K–500K/bln', ARRAY['24jam','murah','putra'],           NULL, FALSE),
(6, 'Kontrakan Pak Heru',  'Gg. Mawar No.2',       -7.5585, 112.2265, 'Kontrakan 2 kamar per unit. Cocok untuk 2–3 mahasiswa split biaya.',                    '081234000021', NULL, 'Rp900K–1.5Jt/bln', ARRAY['kontrakan','split'],              NULL, FALSE),

-- MINIMARKET (cat 7)
(7, 'Indomaret Kampus',   'Jl. Mastrip No.2',       -7.5550, 112.2270, 'Minimarket 24 jam lengkap. Tersedia ATM BCA, fotokopi, dan isi pulsa.',        NULL, '24 Jam', NULL, ARRAY['24jam','atm','print'],  'https://picsum.photos/seed/mini1/400/300', TRUE),
(7, 'Alfamart Veteran',   'Jl. Veteran No.12',      -7.5543, 112.2262, 'Alfamart dengan parkir luas. Tersedia QRIS dan bayar tagihan.',                 NULL, '06.00–24.00', NULL, ARRAY['qris','parkir'],       'https://picsum.photos/seed/mini2/400/300', TRUE),
(7, 'Koperasi Mahasiswa', 'Gedung Student Center',  -7.5557, 112.2280, 'Koperasi kampus. Jual ATK, buku, snack, dan perlengkapan kuliah dengan harga mahasiswa.', '081234000024', 'Senin–Jumat 08.00–16.00', NULL, ARRAY['atk','murah','buku'], 'https://picsum.photos/seed/mini3/400/300', TRUE),

-- LAYANAN KAMPUS (cat 8)
(8, 'BAAK',               'Gedung Rektorat Lt.2',   -7.5560, 112.2282, 'Biro Administrasi Akademik dan Kemahasiswaan. Layanan KRS, transkip, surat keterangan.',   '031-12340001', 'Senin–Jumat 08.00–15.00', NULL, ARRAY['akademik','surat'], NULL, TRUE),
(8, 'Perpustakaan Pusat', 'Gedung Perpus',           -7.5548, 112.2284, 'Perpustakaan dengan 100.000+ koleksi buku dan jurnal. Ruang baca ber-AC. Akses Wi-Fi.',     '031-12340002', 'Senin–Jumat 08.00–20.00\nSabtu 08.00–14.00', NULL, ARRAY['wifi','ac','buku','jurnal'], NULL, TRUE),
(8, 'UPT Kesehatan',      'Dekat Lapangan',          -7.5565, 112.2278, 'Klinik kampus dengan dokter umum dan apoteker. Layanan gratis untuk mahasiswa aktif.',      '031-12340003', 'Senin–Jumat 08.00–16.00', NULL, ARRAY['gratis','dokter'],          NULL, TRUE),

-- KESEHATAN (cat 9)
(9, 'Apotek Sehat',       'Jl. Kampus No.7',         -7.5553, 112.2275, 'Apotek lengkap dengan harga terjangkau. Buka hingga malam. Konsultasi gratis dengan apoteker.', '081234000028', 'Setiap hari 08.00–22.00', NULL, ARRAY['apotek','konsultasi'], NULL, TRUE),

-- LAUNDRY (cat 10)
(10, 'Laundry Kilat',     'Gg. Melati No.3',         -7.5578, 112.2258, 'Laundry kilat 1 hari jadi. Cuci, kering, lipat, dan antar. Harga per kg.',                  '081234000029', 'Setiap hari 07.00–21.00', 'Rp5K–8K/kg', ARRAY['antar-jemput','kilat'], NULL, TRUE),
(10, 'Clean & Fresh Laundry', 'Jl. Kenanga No.10',   -7.5573, 112.2252, 'Laundry satuan dan kiloan. Parfum ekstra gratis. Bisa dijemput.',                            '081234000030', 'Setiap hari 07.00–20.00', 'Rp6K–10K/kg', ARRAY['parfum','jemput'],      NULL, FALSE);
