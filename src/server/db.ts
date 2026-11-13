import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import QRCode from 'qrcode';

const DB_PATH = path.resolve(process.cwd(), 'morifrass.db');
export const db = new DatabaseSync(DB_PATH);

const TOKEN_SECRET = process.env.SESSION_SECRET || 'morifrass-circular-agritech-2026-secret';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export function createAuthToken(payload: { userId: number; email: string; role: string }): string {
  const data = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyAuthToken(token: string): { userId: number; email: string; role: string } | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function createLedgerHash(input: string): string {
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

export async function initDatabase() {
  db.exec(`PRAGMA foreign_keys = ON;`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'supplier', 'petani_kelor', 'supplier_bsf', 'admin', 'distributor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      min_points INTEGER NOT NULL,
      badge_icon TEXT NOT NULL,
      perk_summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '/assets/aistudio/MORIFRASS_Bee_Farmer_Mascot_69774a65.png',
      leaderboard_anonymous INTEGER NOT NULL DEFAULT 0,
      points_total INTEGER NOT NULL DEFAULT 0,
      points_available INTEGER NOT NULL DEFAULT 0,
      points_redeemed INTEGER NOT NULL DEFAULT 0,
      level_id INTEGER REFERENCES user_levels(id),
      is_simulation INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      net_weight_kg REAL NOT NULL DEFAULT 1,
      form TEXT NOT NULL DEFAULT 'Pupuk Padat',
      packaging TEXT NOT NULL DEFAULT 'Standing Pouch',
      composition_text TEXT NOT NULL,
      usage_guide TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      unit_price INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      effective_from TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      quantity_units INTEGER NOT NULL,
      normal_price INTEGER NOT NULL,
      bundle_price INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL CHECK(item_type IN ('finished_good', 'raw_material')),
      ref_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      min_threshold REAL NOT NULL DEFAULT 10,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_name TEXT NOT NULL,
      supplier_type TEXT NOT NULL DEFAULT 'supplier_bsf' CHECK(supplier_type IN ('petani_kelor', 'supplier_bsf', 'umum')),
      category TEXT NOT NULL CHECK(category IN (
        'Peternak BSF',
        'Petani Daun Kelor',
        'Pemasok Biochar Sekam Padi',
        'Pemasok Kompos Matang',
        'Pemasok Bahan Pendukung',
        'Pemasok Kemasan'
      )),
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      verified_status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi' CHECK(verified_status IN ('Menunggu Verifikasi', 'Terverifikasi')),
      rating REAL NOT NULL DEFAULT 4.8,
      is_simulation INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      price_per_unit INTEGER NOT NULL,
      stock_available REAL NOT NULL DEFAULT 0,
      origin_region TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      specifications TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      estimated_delivery TEXT NOT NULL DEFAULT '2–3 hari kerja',
      quality_doc_name TEXT NOT NULL DEFAULT '',
      quality_doc_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      approval_status TEXT NOT NULL DEFAULT 'Disetujui' CHECK(approval_status IN ('Menunggu Persetujuan', 'Disetujui', 'Ditolak')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_material_rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_code TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
      requested_by_user_id INTEGER REFERENCES users(id),
      quantity_kg REAL NOT NULL,
      target_price_per_kg INTEGER NOT NULL,
      offered_price_per_kg INTEGER,
      delivery_estimate TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      supplier_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Menunggu Respon' CHECK(status IN ('Menunggu Respon', 'Penawaran Balik', 'Disetujui', 'Ditolak', 'Dikonversi ke PO')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_material_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_code TEXT NOT NULL DEFAULT '',
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
      rfq_id INTEGER REFERENCES raw_material_rfqs(id) ON DELETE SET NULL,
      ordered_by_user_id INTEGER REFERENCES users(id),
      quantity REAL NOT NULL,
      quote_price INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Dipesan' CHECK(status IN ('Penawaran', 'Dipesan', 'Diterima Pemasok', 'Ditolak Pemasok', 'Dikirim', 'Diterima')),
      payment_status TEXT NOT NULL DEFAULT 'Menunggu Pembayaran' CHECK(payment_status IN ('Menunggu Pembayaran', 'Dibayar (Simulasi)')),
      shipping_status TEXT NOT NULL DEFAULT 'Belum Dikirim' CHECK(shipping_status IN ('Belum Dikirim', 'Dalam Pengiriman', 'Diterima Gudang')),
      tracking_number TEXT NOT NULL DEFAULT '',
      estimated_arrival TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_material_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES raw_material_transactions(id) ON DELETE CASCADE,
      actual_quantity_kg REAL,
      physical_condition TEXT NOT NULL DEFAULT '',
      moisture_pct REAL,
      cleanliness_status TEXT NOT NULL DEFAULT '',
      lab_test_summary TEXT NOT NULL DEFAULT '',
      lab_doc_name TEXT NOT NULL DEFAULT '',
      lab_doc_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Menunggu Pemeriksaan' CHECK(status IN ('Menunggu Pemeriksaan', 'Lolos Pemeriksaan', 'Ditolak')),
      inspector_email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      inspected_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supply_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_role TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      evaluated_by TEXT NOT NULL,
      timeliness_score INTEGER NOT NULL CHECK(timeliness_score BETWEEN 1 AND 5),
      quality_score INTEGER NOT NULL CHECK(quality_score BETWEEN 1 AND 5),
      communication_score INTEGER NOT NULL CHECK(communication_score BETWEEN 1 AND 5),
      overall_score REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_kg REAL NOT NULL,
      pouches_produced INTEGER NOT NULL,
      production_date TEXT NOT NULL,
      packaging_date TEXT NOT NULL,
      formulation_note TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Selesai Dikemas',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_compositions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      material_name TEXT NOT NULL,
      percentage REAL NOT NULL,
      quantity_kg REAL NOT NULL,
      origin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL UNIQUE REFERENCES production_batches(id) ON DELETE CASCADE,
      moisture_pct REAL,
      ph_level REAL,
      npk_summary TEXT NOT NULL DEFAULT '',
      c_organic_pct REAL,
      cn_ratio REAL,
      lab_result_summary TEXT NOT NULL DEFAULT '',
      test_date TEXT,
      document_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Menunggu pengujian' CHECK(status IN (
        'Menunggu pengujian',
        'Dalam pemeriksaan',
        'Lulus pemeriksaan',
        'Memerlukan evaluasi'
      )),
      tested_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_traceability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL UNIQUE REFERENCES production_batches(id) ON DELETE CASCADE,
      qr_payload TEXT NOT NULL,
      qr_data_url TEXT NOT NULL,
      scan_count INTEGER NOT NULL DEFAULT 0,
      distribution_region TEXT NOT NULL DEFAULT 'Jawa Timur & Nasional',
      distributor_name TEXT NOT NULL DEFAULT 'Mitra Logistik Agritech',
      verification_status TEXT NOT NULL DEFAULT 'Tercatat di Simulasi Ledger',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blockchain_ledger_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      tx_id TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      previous_hash TEXT NOT NULL,
      record_hash TEXT NOT NULL,
      action_type TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      payload_summary TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      is_simulation INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total_items INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      bundle_discount INTEGER NOT NULL DEFAULT 0,
      voucher_code TEXT,
      voucher_discount INTEGER NOT NULL DEFAULT 0,
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      shipping_discount INTEGER NOT NULL DEFAULT 0,
      grand_total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Menunggu pembayaran' CHECK(status IN (
        'Menunggu pembayaran',
        'Pembayaran dikonfirmasi',
        'Diproses',
        'Dikemas',
        'Dalam pengiriman',
        'Selesai'
      )),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      bundle_id INTEGER NOT NULL REFERENCES product_bundles(id),
      bundle_name TEXT NOT NULL,
      units_per_bundle INTEGER NOT NULL,
      quantity_bundles INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      method TEXT NOT NULL CHECK(method IN ('Transfer Bank', 'QRIS', 'E-Wallet', 'Pembayaran Manual Prototype')),
      status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi' CHECK(status IN ('Menunggu Konfirmasi', 'Terkonfirmasi')),
      reference_code TEXT NOT NULL,
      is_prototype_simulation INTEGER NOT NULL DEFAULT 1,
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS shipping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      courier TEXT NOT NULL,
      service_name TEXT NOT NULL,
      tracking_number TEXT NOT NULL DEFAULT '',
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Menunggu Pengemasan' CHECK(status IN ('Menunggu Pengemasan', 'Dalam Pengiriman', 'Terkirim')),
      distributor_id INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(order_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS learning_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      content_points TEXT NOT NULL,
      video_url TEXT NOT NULL DEFAULT '',
      estimated_minutes INTEGER NOT NULL DEFAULT 4,
      points_reward INTEGER NOT NULL DEFAULT 10,
      sort_order INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS learning_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
      article_completed INTEGER NOT NULL DEFAULT 0,
      video_watched INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      UNIQUE(user_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER REFERENCES learning_materials(id) ON DELETE SET NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false', 'image_guess')),
      question TEXT NOT NULL,
      image_hint TEXT NOT NULL DEFAULT '',
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score_pct INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      mission_type TEXT NOT NULL CHECK(mission_type IN ('daily', 'weekly')),
      action_key TEXT NOT NULL,
      target_count INTEGER NOT NULL DEFAULT 1,
      points_reward INTEGER NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      progress_count INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, mission_id)
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      tx_type TEXT NOT NULL CHECK(tx_type IN ('earn', 'redeem')),
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_code TEXT NOT NULL,
      badge_name TEXT NOT NULL,
      description TEXT NOT NULL,
      earned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_code)
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      reward_type TEXT NOT NULL CHECK(reward_type IN ('free_shipping', 'discount_fixed')),
      points_cost INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      max_subsidy INTEGER NOT NULL DEFAULT 0,
      min_purchase INTEGER NOT NULL DEFAULT 0,
      quota INTEGER NOT NULL DEFAULT 100,
      remaining_quota INTEGER NOT NULL DEFAULT 100,
      valid_days INTEGER NOT NULL DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS voucher_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_type TEXT NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      max_subsidy INTEGER NOT NULL DEFAULT 0,
      min_purchase INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      used_order_id INTEGER REFERENCES orders(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voucher_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL REFERENCES voucher_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
      points_spent INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Check if already seeded
  const existingUser = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number };
  if (existingUser.cnt > 0) return;

  // 1. Seed Levels
  const levels = [
    [1, 'Seed Beginner', 0, 'seed', 'Akses materi dasar MORI-EDU & misi harian'],
    [2, 'Green Explorer', 100, 'sprout', 'Prioritas voucher gratis ongkir'],
    [3, 'Green Farmer', 250, 'leaf', 'Bonus poin kuis & akses badge keahlian'],
    [4, 'Eco Champion', 500, 'award', 'Diskon bundling prioritas & leaderboard utama'],
    [5, 'MORIFRASS Guardian', 900, 'shield', 'Duta pertanian sirkular & reward eksklusif'],
  ];
  const insertLevel = db.prepare(
    `INSERT INTO user_levels (level_number, name, min_points, badge_icon, perk_summary) VALUES (?, ?, ?, ?, ?)`
  );
  for (const lvl of levels) insertLevel.run(...lvl);

  // 2. Seed Users (Demo Simulation Accounts)
  const insertUser = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`);
  const insertProfile = db.prepare(
    `INSERT INTO user_profiles (user_id, full_name, phone, address, city, points_total, points_available, points_redeemed, level_id, is_simulation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const demoPass = hashPassword('morifrass123');
  const customerId = Number(insertUser.run('petani@morifrass.id', demoPass, 'customer').lastInsertRowid);
  insertProfile.run(customerId, 'Budi Santoso (Petani Hortikultura)', '081234567801', 'Jl. Raya Tani No. 18, Batu', 'Malang', 320, 220, 100, 3);

  const customer2Id = Number(insertUser.run('sari@morifrass.id', demoPass, 'customer').lastInsertRowid);
  insertProfile.run(customer2Id, 'Sari Wulandari', '081234567809', 'Jl. Melati No. 5', 'Kediri', 540, 390, 150, 4);

  const supplierBsfUserId = Number(insertUser.run('bsf@morifrass.id', demoPass, 'supplier_bsf').lastInsertRowid);
  insertProfile.run(supplierBsfUserId, 'Hendra Wijaya (BSF Eco Farm)', '081345678902', 'Desa Sumberrejo, Bojonegoro', 'Bojonegoro', 140, 140, 0, 2);

  const petaniKelorUserId = Number(insertUser.run('kelor@morifrass.id', demoPass, 'petani_kelor').lastInsertRowid);
  insertProfile.run(petaniKelorUserId, 'Siti Aminah (Poktan Kelor Madura)', '081234001122', 'Kec. Bluto, Sumenep', 'Sumenep', 160, 160, 0, 2);

  const adminId = Number(insertUser.run('admin@morifrass.id', demoPass, 'admin').lastInsertRowid);
  insertProfile.run(adminId, 'Dewi Kusuma (Tim Produksi MORIFRASS)', '081122334455', 'Jl. Inovasi Agritech No. 1', 'Surabaya', 950, 950, 0, 5);

  const distributorId = Number(insertUser.run('distributor@morifrass.id', demoPass, 'distributor').lastInsertRowid);
  insertProfile.run(distributorId, 'Rizky Pratama (Mitra Distribusi)', '081998877665', 'Gudang Agrilogistik Timur', 'Sidoarjo', 180, 180, 0, 2);

  // 3. Seed Single Product (1 kg standing pouch) + Price + 3 Bundles
  const productId = Number(
    db
      .prepare(
        `INSERT INTO products (sku, name, description, net_weight_kg, form, packaging, composition_text, usage_guide, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'MF-BIO-1KG',
        'MORIFRASS – Pupuk Bioaktif Organik',
        'Pupuk bioaktif organik berbahan dasar frass Black Soldier Fly (BSF) dan daun kelor (Moringa oleifera), diformulasikan dengan biochar sekam padi dan kompos matang.',
        1,
        'Pupuk Padat',
        'Standing Pouch 1 kg',
        'Frass Black Soldier Fly (BSF), Daun Kelor (Moringa oleifera), Biochar Sekam Padi, Kompos Matang.',
        'Taburkan 100–200 g/m² secara merata, aduk dengan tanah atau kompos, dan aplikasikan berkala setiap 2–4 minggu.',
        '/assets/aistudio/image_817a15a9.png'
      ).lastInsertRowid
  );

  db.prepare(`INSERT INTO product_prices (product_id, unit_price) VALUES (?, ?)`).run(productId, 35000);

  const insertBundle = db.prepare(
    `INSERT INTO product_bundles (product_id, name, slug, quantity_units, normal_price, bundle_price, discount_amount, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const b1 = Number(
    insertBundle.run(productId, 'Paket Satuan', 'paket-satuan', 1, 35000, 35000, 0, '1 kemasan standing pouch 1 kg — cocok untuk uji coba lahan & pekarangan.', 1).lastInsertRowid
  );
  const b2 = Number(
    insertBundle.run(productId, 'Paket Hemat', 'paket-hemat', 3, 105000, 99000, 6000, '3 kemasan (3 kg total) — hemat Rp6.000 untuk kebutuhan kebun produktif.', 2).lastInsertRowid
  );
  const b3 = Number(
    insertBundle.run(productId, 'Paket Grosir', 'paket-grosir', 5, 175000, 160000, 15000, '5 kemasan (5 kg total) — hemat Rp15.000 untuk kelompok tani & distributor.', 3).lastInsertRowid
  );

  // Finished Goods Inventory
  db.prepare(`INSERT INTO inventory (item_type, ref_id, item_name, unit, quantity, min_threshold) VALUES ('finished_good', ?, ?, 'kemasan (1 kg)', ?, ?)`).run(
    productId,
    'MORIFRASS Pupuk Bioaktif Organik 1 kg',
    420,
    50
  );

  // 4. Seed Suppliers & Raw Materials Marketplace
  const insertSupplier = db.prepare(
    `INSERT INTO suppliers (user_id, company_name, supplier_type, category, contact_name, phone, location, description, verified_status, rating, is_simulation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  const s1 = Number(insertSupplier.run(supplierBsfUserId, 'BSF Eco Farm Bojonegoro', 'supplier_bsf', 'Peternak BSF', 'Hendra Wijaya', '081345678902', 'Bojonegoro, Jawa Timur', 'Unit budidaya Black Soldier Fly skala komunal dengan pakan residu pasar organik terpilah.', 'Terverifikasi', 4.9).lastInsertRowid);
  const s2 = Number(insertSupplier.run(petaniKelorUserId, 'Kelompok Tani Kelor Madura', 'petani_kelor', 'Petani Daun Kelor', 'Siti Aminah', '081234001122', 'Sumenep, Jawa Timur', 'Sentra budidaya Moringa oleifera organik tanpa pestisida sintetis.', 'Terverifikasi', 4.8).lastInsertRowid);
  const s3 = Number(insertSupplier.run(null, 'Agro Biochar Nusantara', 'umum', 'Pemasok Biochar Sekam Padi', 'Agus Salim', '081555667788', 'Ngawi, Jawa Timur', 'Produsen arang hayati sekam padi metode pirolisis rendah emisi.', 'Terverifikasi', 4.7).lastInsertRowid);
  const s4 = Number(insertSupplier.run(null, 'Kompos Hijau Sidoarjo', 'umum', 'Pemasok Kompos Matang', 'Bambang Hermanto', '081777889900', 'Sidoarjo, Jawa Timur', 'Pengolahan kompos matang terfermentasi standar agronomi.', 'Terverifikasi', 4.8).lastInsertRowid);
  const s5 = Number(insertSupplier.run(null, 'Kelor Organik Blora', 'petani_kelor', 'Petani Daun Kelor', 'Rina Kartika', '081888990011', 'Blora, Jawa Tengah', 'Pemasok daun kelor segar dan kering oven suhu rendah.', 'Menunggu Verifikasi', 4.6).lastInsertRowid);
  const s6 = Number(insertSupplier.run(null, 'Surya Maggot Gresik', 'supplier_bsf', 'Peternak BSF', 'Yusuf Maulana', '081666778899', 'Gresik, Jawa Timur', 'Mitra peternak BSF penghasil maggot kering oven & frass ayak halus.', 'Terverifikasi', 4.7).lastInsertRowid);

  const insertMaterial = db.prepare(
    `INSERT INTO raw_materials (supplier_id, name, category, unit, price_per_unit, stock_available, origin_region, description, specifications, estimated_delivery, quality_doc_name, is_active, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const rm1 = Number(insertMaterial.run(
    s1,
    'Frass BSF Ayak Halus Grade A',
    'Frass BSF',
    'kg',
    5500,
    1250,
    'Bojonegoro, Jawa Timur',
    'Frass hasil pencernaan larva BSF pakan sayur-buah, sudah diayak mesh 20 dan dikeringanginkan.',
    'Klaim pemasok: Kadar air ±14%, tekstur remah kering, bebas plastik.',
    '2–3 hari kerja',
    'COA-Klaim-BSF-Bojonegoro.pdf',
    'Disetujui'
  ).lastInsertRowid);
  const rm1b = Number(insertMaterial.run(
    s1,
    'Maggot BSF Kering Oven',
    'Maggot BSF Kering',
    'kg',
    32000,
    420,
    'Bojonegoro, Jawa Timur',
    'Maggot BSF kering oven suhu 65°C untuk bahan suplemen protein & kitin formulasi bioaktif.',
    'Klaim pemasok: Protein ±42%, kadar air <10%, utuh bersih.',
    '2–3 hari kerja',
    'Klaim-Uji-Proksimat-BSF.pdf',
    'Disetujui'
  ).lastInsertRowid);
  const rm2 = Number(insertMaterial.run(
    s2,
    'Daun Kelor Kering (Moringa oleifera)',
    'Daun Kelor Kering',
    'kg',
    18000,
    380,
    'Sumenep, Jawa Timur',
    'Daun kelor organik petik pagi, dikeringkan metode teduh (shade drying) menjaga zat bioaktif zeatin.',
    'Klaim pemasok: Kadar air <11%, hijau alami, bebas ranting keras.',
    '3–4 hari kerja',
    'Klaim-Panen-Organik-Sumenep.pdf',
    'Disetujui'
  ).lastInsertRowid);
  const rm2b = Number(insertMaterial.run(
    s2,
    'Daun Kelor Segar Petik Harian',
    'Daun Kelor Segar',
    'kg',
    9500,
    600,
    'Sumenep, Jawa Timur',
    'Daun kelor segar tanpa tangkai besar, dipetik maksimal 12 jam sebelum pengiriman berpendingin.',
    'Klaim pemasok: Segar hijau tua, bebas hama ulat, kemasan krat berventilasi.',
    '1–2 hari kerja',
    '',
    'Disetujui'
  ).lastInsertRowid);
  const rm3 = Number(insertMaterial.run(
    s3,
    'Biochar Sekam Padi Aktif',
    'Biochar Sekam Padi',
    'kg',
    4200,
    920,
    'Ngawi, Jawa Timur',
    'Arang sekam hasil pirolisis terkontrol dengan luas permukaan pori tinggi.',
    'Klaim pemasok: pH 7.4, karbon tertambat tinggi, bebas abu berlebih.',
    '2–3 hari kerja',
    '',
    'Disetujui'
  ).lastInsertRowid);
  const rm4 = Number(insertMaterial.run(
    s4,
    'Kompos Matang Terfermentasi',
    'Kompos Matang',
    'kg',
    2500,
    1600,
    'Sidoarjo, Jawa Timur',
    'Kompos hijauan matang stabil tidak panas dan tidak berbau.',
    'Klaim pemasok: C/N ±16, warna cokelat kehitaman.',
    '1–2 hari kerja',
    '',
    'Disetujui'
  ).lastInsertRowid);
  const rm5 = Number(insertMaterial.run(
    s5,
    'Daun Kelor Kering Ekonomis',
    'Daun Kelor Kering',
    'kg',
    16500,
    250,
    'Blora, Jawa Tengah',
    'Daun kelor kering matahari tidak langsung untuk bahan baku pupuk bioaktif.',
    'Klaim pemasok: Kadar air ±12%, potongan daun kasar.',
    '3–5 hari kerja',
    '',
    'Menunggu Persetujuan'
  ).lastInsertRowid);
  const rm6 = Number(insertMaterial.run(
    s6,
    'Frass BSF Organik Curah',
    'Frass BSF',
    'kg',
    5200,
    900,
    'Gresik, Jawa Timur',
    'Frass BSF curah kemasan karung 25 kg siap kirim ke gudang produksi Surabaya.',
    'Klaim pemasok: Kadar air ±15%, siap ayak ulang.',
    '1–2 hari kerja',
    '',
    'Disetujui'
  ).lastInsertRowid);

  // Sync raw materials into inventory table too
  const insertInv = db.prepare(`INSERT INTO inventory (item_type, ref_id, item_name, unit, quantity, min_threshold) VALUES ('raw_material', ?, ?, ?, ?, ?)`);
  insertInv.run(rm1, 'Frass BSF Kering', 'kg', 850, 200);
  insertInv.run(rm2, 'Daun Kelor Kering', 'kg', 240, 50);
  insertInv.run(rm3, 'Biochar Sekam Padi', 'kg', 620, 150);
  insertInv.run(rm4, 'Kompos Matang', 'kg', 950, 250);
  insertInv.run(rm1b, 'Maggot BSF Kering', 'kg', 120, 30);

  // Seed RFQ
  const rfq1 = Number(
    db
      .prepare(
        `INSERT INTO raw_material_rfqs (rfq_code, supplier_id, raw_material_id, requested_by_user_id, quantity_kg, target_price_per_kg, offered_price_per_kg, delivery_estimate, notes, supplier_notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'RFQ-MF-2026-001',
        s2,
        rm2,
        adminId,
        150,
        17000,
        17500,
        '3 hari kerja',
        'Mohon penawaran harga untuk pengiriman rutin 150 kg Daun Kelor Kering ke gudang Surabaya.',
        'Kami sanggup kirim 150 kg di harga Rp17.500/kg dengan kemasan karung kedap.',
        'Penawaran Balik'
      ).lastInsertRowid
  );
  db.prepare(
    `INSERT INTO raw_material_rfqs (rfq_code, supplier_id, raw_material_id, requested_by_user_id, quantity_kg, target_price_per_kg, delivery_estimate, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'RFQ-MF-2026-002',
    s1,
    rm1b,
    adminId,
    100,
    30500,
    '2 hari kerja',
    'Permintaan penawaran Maggot BSF Kering untuk batch formulasi Desember.',
    'Menunggu Respon'
  );

  // Raw Material Transactions (Purchase Orders) + Inspections
  const po1 = Number(
    db
      .prepare(
        `INSERT INTO raw_material_transactions (po_code, supplier_id, raw_material_id, rfq_id, ordered_by_user_id, quantity, quote_price, total_price, status, payment_status, shipping_status, tracking_number, estimated_arrival, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('PO-MF-2026-001', s1, rm1, null, adminId, 300, 5500, 1650000, 'Diterima', 'Dibayar (Simulasi)', 'Diterima Gudang', 'TRK-BSF-0019', '2026-10-12', 'Pengadaan frass BSF untuk Batch #001 & #002 (Simulasi)').lastInsertRowid
  );
  db.prepare(
    `INSERT INTO raw_material_inspections (transaction_id, actual_quantity_kg, physical_condition, moisture_pct, cleanliness_status, lab_test_summary, lab_doc_name, status, inspector_email, notes, inspected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    po1,
    298.5,
    'Butiran kering merata, tidak menggumpal, aroma tanah netral.',
    14.1,
    'Bersih, bebas plastik & benda asing.',
    'Lolos uji penerimaan internal tim MORIFRASS (Simulasi).',
    'QC-IN-PO001.pdf',
    'Lolos Pemeriksaan',
    'admin@morifrass.id',
    'Selisih susut 1.5 kg masih dalam batas toleransi.'
  );

  const po2 = Number(
    db
      .prepare(
        `INSERT INTO raw_material_transactions (po_code, supplier_id, raw_material_id, rfq_id, ordered_by_user_id, quantity, quote_price, total_price, status, payment_status, shipping_status, tracking_number, estimated_arrival, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('PO-MF-2026-002', s2, rm2, rfq1, adminId, 80, 18000, 1440000, 'Dikirim', 'Menunggu Pembayaran', 'Dalam Pengiriman', 'TRK-KLR-0082', '2026-11-15', 'Pengiriman daun kelor kering grade A (Simulasi)').lastInsertRowid
  );
  db.prepare(
    `INSERT INTO raw_material_inspections (transaction_id, status, notes) VALUES (?, 'Menunggu Pemeriksaan', 'Menunggu barang tiba di gudang untuk ditimbang & diperiksa fisik.')`
  ).run(po2);

  // Seed Supply Chat Messages
  const insertChat = db.prepare(
    `INSERT INTO supply_chat_messages (supplier_id, sender_user_id, sender_role, sender_name, message) VALUES (?, ?, ?, ?, ?)`
  );
  insertChat.run(s1, adminId, 'admin', 'Dewi Kusuma (Admin MORIFRASS)', 'Halo Pak Hendra, apakah stok Frass BSF Ayak Halus aman untuk kebutuhan 500 kg bulan ini?');
  insertChat.run(s1, supplierBsfUserId, 'supplier_bsf', 'Hendra Wijaya (BSF Eco Farm)', 'Halo Bu Dewi, stok siap 1.250 kg di gudang Bojonegoro. Pengiriman bisa 2 hari kerja.');
  insertChat.run(s2, adminId, 'admin', 'Dewi Kusuma (Admin MORIFRASS)', 'Bu Siti, kami sudah kirim RFQ-MF-2026-001 untuk Daun Kelor Kering 150 kg ya.');
  insertChat.run(s2, petaniKelorUserId, 'petani_kelor', 'Siti Aminah (Poktan Kelor Madura)', 'Baik Bu, penawaran balik Rp17.500/kg sudah kami kirimkan di sistem.');

  // Seed Supplier Evaluations
  db.prepare(
    `INSERT INTO supplier_evaluations (supplier_id, evaluated_by, timeliness_score, quality_score, communication_score, overall_score, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(s1, 'admin@morifrass.id', 5, 5, 5, 5.0, 'Pengiriman tepat waktu, hasil pemeriksaan fisik frass bersih dan kering.');
  db.prepare(
    `INSERT INTO supplier_evaluations (supplier_id, evaluated_by, timeliness_score, quality_score, communication_score, overall_score, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(s2, 'admin@morifrass.id', 5, 5, 4, 4.7, 'Kualitas daun kelor kering sangat baik dan responsif.');

  // 5. Seed Production Batches + Compositions + Quality Tests + Traceability + QR + Ledger
  const batchSeeds = [
    {
      code: 'BATCH-MF-2026-001',
      qty: 250,
      pouches: 250,
      prodDate: '2026-10-15',
      packDate: '2026-10-17',
      note: 'Formulasi awal standar (Frass BSF 50%, Kompos 30%, Biochar 12%, Daun Kelor 8%) — dapat diedit admin.',
      qcStatus: 'Lulus pemeriksaan',
      moisture: 14.2,
      ph: 6.8,
      npk: 'N 2.8% · P₂O₅ 1.9% · K₂O 2.4%',
      cOrg: 32.5,
      cn: 15.4,
      labSummary: 'Memenuhi standar mutu pupuk organik padat (Permentan No. 261/2019 — Simulasi Uji Lab).',
      testDate: '2026-10-16',
      docRef: 'LAB-MF-2026-001.pdf',
      distRegion: 'Malang, Batu, Kediri',
      distName: 'Mitra Logistik Agritech Jatim',
    },
    {
      code: 'BATCH-MF-2026-002',
      qty: 200,
      pouches: 200,
      prodDate: '2026-11-02',
      packDate: '2026-11-04',
      note: 'Formulasi awal pengayaan kelor 10% untuk tanaman hortikultura daun — dapat diedit admin.',
      qcStatus: 'Dalam pemeriksaan',
      moisture: 15.1,
      ph: 6.7,
      npk: 'N 3.0% · P₂O₅ 1.8% · K₂O 2.5%',
      cOrg: 31.8,
      cn: 14.9,
      labSummary: 'Sampel sedang dalam verifikasi uji laboratorium tahap akhir.',
      testDate: '2026-11-05',
      docRef: 'LAB-MF-2026-002-DRAFT.pdf',
      distRegion: 'Surabaya, Sidoarjo, Gresik',
      distName: 'Mitra Logistik Agritech Jatim',
    },
  ];

  for (let i = 0; i < batchSeeds.length; i++) {
    const b = batchSeeds[i];
    const batchId = Number(
      db
        .prepare(
          `INSERT INTO production_batches (batch_code, product_id, quantity_kg, pouches_produced, production_date, packaging_date, formulation_note, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(b.code, productId, b.qty, b.pouches, b.prodDate, b.packDate, b.note, adminId).lastInsertRowid
    );

    const comps = [
      [rm1, s1, 'Frass Black Soldier Fly (BSF)', 50, b.qty * 0.5, 'Bojonegoro, Jatim'],
      [rm4, s4, 'Kompos Matang Terfermentasi', 30, b.qty * 0.3, 'Sidoarjo, Jatim'],
      [rm3, s3, 'Biochar Sekam Padi', 12, b.qty * 0.12, 'Ngawi, Jatim'],
      [rm2, s2, 'Serbuk Daun Kelor (Moringa oleifera)', 8, b.qty * 0.08, 'Sumenep, Madura'],
    ];
    const insertComp = db.prepare(
      `INSERT INTO batch_compositions (batch_id, raw_material_id, supplier_id, material_name, percentage, quantity_kg, origin) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of comps) insertComp.run(batchId, ...c);

    db.prepare(
      `INSERT INTO quality_tests (batch_id, moisture_pct, ph_level, npk_summary, c_organic_pct, cn_ratio, lab_result_summary, test_date, document_ref, status, tested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(batchId, b.moisture, b.ph, b.npk, b.cOrg, b.cn, b.labSummary, b.testDate, b.docRef, b.qcStatus, 'Tim QC Lab MORIFRASS');

    const qrPayload = `MORIFRASS:${b.code}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      color: { dark: '#144A17', light: '#FFFFFF' },
    });

    db.prepare(
      `INSERT INTO product_traceability (batch_id, qr_payload, qr_data_url, scan_count, distribution_region, distributor_name, verification_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      batchId,
      qrPayload,
      qrDataUrl,
      i === 0 ? 42 : 11,
      b.distRegion,
      b.distName,
      'Tercatat di Simulasi Ledger',
      'Catatan ketertelusuran prototype — terhubung ke seluruh pemasok bahan baku.'
    );

    const genesisPrev = '0x' + '0'.repeat(64);
    const h1 = createLedgerHash(`${b.code}:GENESIS:${b.prodDate}`);
    const h2 = createLedgerHash(`${h1}:QC:${b.qcStatus}`);
    const h3 = createLedgerHash(`${h2}:PACK:${b.packDate}`);

    const insertLedger = db.prepare(
      `INSERT INTO blockchain_ledger_records (batch_id, tx_id, block_number, previous_hash, record_hash, action_type, actor_role, payload_summary, timestamp, is_simulation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    insertLedger.run(batchId, h1.slice(0, 22), 1024 + i * 10, genesisPrev, h1, 'BATCH_CREATED', 'Admin/Produsen', `Produksi ${b.pouches} kemasan 1 kg (${b.qty} kg) dicatat`, `${b.prodDate} 09:15:00`);
    insertLedger.run(batchId, h2.slice(0, 22), 1025 + i * 10, h1, h2, 'QC_RECORDED', 'Quality Control', `Status QC: ${b.qcStatus} | pH ${b.ph} | Kadar Air ${b.moisture}%`, `${b.testDate} 14:30:00`);
    insertLedger.run(batchId, h3.slice(0, 22), 1026 + i * 10, h2, h3, 'PACKAGING_SEALED', 'Produsen', `Pengemasan standing pouch & cetak QR unik ${b.code}`, `${b.packDate} 11:00:00`);
  }

  // 6. Seed Completed & In-Progress Orders + Payments + Shipping + Verified Reviews
  const insertOrder = db.prepare(
    `INSERT INTO orders (order_code, user_id, total_items, subtotal, bundle_discount, voucher_code, voucher_discount, shipping_cost, shipping_discount, grand_total, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const o1 = Number(
    insertOrder.run('ORD-MF-261001', customerId, 3, 105000, 6000, null, 0, 15000, 0, 114000, 'Selesai', '2026-10-20 10:20:00').lastInsertRowid
  );
  db.prepare(`INSERT INTO order_details (order_id, bundle_id, bundle_name, units_per_bundle, quantity_bundles, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    o1, b2, 'Paket Hemat', 3, 1, 99000, 99000
  );
  db.prepare(`INSERT INTO payments (order_id, method, status, reference_code, is_prototype_simulation, paid_at) VALUES (?, 'QRIS', 'Terkonfirmasi', 'SIM-QRIS-90211', 1, '2026-10-20 10:25:00')`).run(o1);
  db.prepare(`INSERT INTO shipping (order_id, courier, service_name, tracking_number, recipient_name, phone, address, city, status, distributor_id) VALUES (?, 'JNE Cargo', 'Reguler', 'JNE-MF-883210', 'Budi Santoso', '081234567801', 'Jl. Raya Tani No. 18, Batu', 'Malang', 'Terkirim', ?)`).run(o1, distributorId);

  const o2 = Number(
    insertOrder.run('ORD-MF-261102', customer2Id, 5, 175000, 15000, null, 0, 20000, 0, 180000, 'Selesai', '2026-11-01 09:00:00').lastInsertRowid
  );
  db.prepare(`INSERT INTO order_details (order_id, bundle_id, bundle_name, units_per_bundle, quantity_bundles, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    o2, b3, 'Paket Grosir', 5, 1, 160000, 160000
  );
  db.prepare(`INSERT INTO payments (order_id, method, status, reference_code, is_prototype_simulation, paid_at) VALUES (?, 'Transfer Bank', 'Terkonfirmasi', 'SIM-BCA-77102', 1, '2026-11-01 09:10:00')`).run(o2);
  db.prepare(`INSERT INTO shipping (order_id, courier, service_name, tracking_number, recipient_name, phone, address, city, status, distributor_id) VALUES (?, 'SiCepat', 'Gokil', 'SC-MF-551920', 'Sari Wulandari', '081234567809', 'Jl. Melati No. 5', 'Kediri', 'Terkirim', ?)`).run(o2, distributorId);

  const o3 = Number(
    insertOrder.run('ORD-MF-261108', customerId, 1, 35000, 0, null, 0, 12000, 0, 47000, 'Dalam pengiriman', '2026-11-08 13:15:00').lastInsertRowid
  );
  db.prepare(`INSERT INTO order_details (order_id, bundle_id, bundle_name, units_per_bundle, quantity_bundles, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    o3, b1, 'Paket Satuan', 1, 1, 35000, 35000
  );
  db.prepare(`INSERT INTO payments (order_id, method, status, reference_code, is_prototype_simulation, paid_at) VALUES (?, 'E-Wallet', 'Terkonfirmasi', 'SIM-OVO-44109', 1, '2026-11-08 13:20:00')`).run(o3);
  db.prepare(`INSERT INTO shipping (order_id, courier, service_name, tracking_number, recipient_name, phone, address, city, status, distributor_id) VALUES (?, 'J&T Express', 'EZ', 'JT-MF-330192', 'Budi Santoso', '081234567801', 'Jl. Raya Tani No. 18, Batu', 'Malang', 'Dalam Pengiriman', ?)`).run(o3, distributorId);

  // Verified Reviews (only from completed orders)
  db.prepare(`INSERT INTO reviews (order_id, user_id, product_id, rating, comment, photo_url) VALUES (?, ?, ?, ?, ?, ?)`).run(
    o1,
    customerId,
    productId,
    5,
    'Tanaman cabai dan sawi di kebun Batu tumbuh jauh lebih hijau dalam 2 minggu. QR batch langsung terbaca lengkap.',
    ''
  );
  db.prepare(`INSERT INTO reviews (order_id, user_id, product_id, rating, comment, photo_url) VALUES (?, ?, ?, ?, ?, ?)`).run(
    o2,
    customer2Id,
    productId,
    5,
    'Kemasan standing pouch 1 kg rapi, tidak berbau menyengat, dan hemat dengan Paket Grosir.',
    ''
  );

  // 7. Seed MORI-EDU Learning Materials (8 topics, concise & scannable)
  const materials = [
    [
      'pengenalan-pupuk-organik',
      'Pengenalan Pupuk Organik',
      'Dasar Agronomi',
      'Peran bahan organik dalam memulihkan struktur tanah, kapasitas tukar kation, dan kehidupan mikroba.',
      JSON.stringify([
        'Memperbaiki porositas dan daya ikat air tanah secara alami.',
        'Menyediakan nutrisi pelepasan lambat agar akar tidak terbakar.',
        'Mengurangi ketergantungan pupuk kimia sintetis jangka panjang.'
      ]),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0',
      3,
      10,
      1,
    ],
    [
      'black-soldier-fly-dan-frass',
      'Black Soldier Fly & Frass',
      'Teknologi BSF',
      'Bagaimana larva Hermetia illucens mengonversi limbah organik menjadi frass kaya kitin dan mikroba baik.',
      JSON.stringify([
        'Larva BSF mengurai limbah organik hingga 70% lebih cepat.',
        'Frass mengandung kitin alami yang memicu ketahanan tanaman terhadap hama.',
        'Kaya nitrogen organik dan mikroorganisme menguntungkan tanah.'
      ]),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0',
      4,
      10,
      2,
    ],
    [
      'daun-kelor-bioaktif',
      'Daun Kelor sebagai Bioaktif',
      'Bahan Bioaktif',
      'Kandungan zeatin, antioksidan, dan mineral pada Moringa oleifera sebagai biostimulan alami.',
      JSON.stringify([
        'Mengandung hormon tumbuh alami (sitokinin/zeatin) untuk memacu tunas.',
        'Kaya kalsium, kalium, dan magnesium untuk fase vegetatif.',
        'Mendukung penyerapan hara lebih optimal di zona perakaran.'
      ]),
      '',
      3,
      10,
      3,
    ],
    [
      'biochar-dan-kompos',
      'Biochar Sekam Padi & Kompos',
      'Formulasi Tanah',
      'Sinergi arang hayati berpori dan kompos matang dalam menjaga kelembaban dan nutrisi.',
      JSON.stringify([
        'Biochar sekam padi memiliki pori mikro sebagai rumah bagi mikroba baik.',
        'Mencegah pencucian unsur hara saat musim hujan.',
        'Kompos matang menstabilkan C/N rasio sehingga aman bagi bibit.'
      ]),
      '',
      4,
      10,
      4,
    ],
    [
      'ekonomi-sirkular',
      'Ekonomi Sirkular Agritech',
      'Keberlanjutan',
      'Menutup siklus limbah organik kota dan pertanian kembali menjadi nutrisi bagi lahan produktif.',
      JSON.stringify([
        'Limbah organik -> Pakan BSF -> Frass -> Pupuk MORIFRASS -> Panen sehat.',
        'Meningkatkan pendapatan peternak BSF dan petani daun kelor lokal.',
        'Mengurangi emisi metana dari penumpukan sampah organik.'
      ]),
      '',
      3,
      10,
      5,
    ],
    [
      'kesuburan-tanah',
      'Kesuburan Tanah Berkelanjutan',
      'Dasar Agronomi',
      'Membaca indikator tanah sehat: pH ideal, C-organik, dan keseimbangan rasio C/N.',
      JSON.stringify([
        'pH tanah optimal 6.0–7.0 memaksimalkan penyerapan unsur makro & mikro.',
        'Kadar C-organik di atas 2% menandakan ekosistem tanah aktif.',
        'Rasio C/N seimbang mencegah immobilisasi nitrogen.'
      ]),
      '',
      4,
      10,
      6,
    ],
    [
      'pertanian-berkelanjutan',
      'Pertanian Berkelanjutan & Traceability',
      'Teknologi Digital',
      'Mengapa ketertelusuran QR Code & pencatatan ledger menjaga transparansi mutu pertanian.',
      JSON.stringify([
        'Petani dapat mengecek asal bahan baku dan hasil uji lab setiap batch.',
        'Meningkatkan kepercayaan pasar terhadap produk pertanian organik.',
        'Mendorong standar produksi yang terdokumentasi rapi.'
      ]),
      '',
      3,
      10,
      7,
    ],
    [
      'panduan-penggunaan-morifrass',
      'Panduan Praktis MORIFRASS',
      'Aplikasi Lahan',
      'Dosis tepat 100–200 g/m² dan jadwal pemupukan setiap 2–4 minggu untuk hasil optimal.',
      JSON.stringify([
        'Taburkan 100–200 g/m² di sekitar area perakaran atau bedengan.',
        'Aduk ringan dengan tanah atas atau media kompos lalu siram secukupnya.',
        'Ulangi aplikasi secara berkala setiap 2–4 minggu.'
      ]),
      '',
      2,
      10,
      8,
    ],
  ];

  const insertMat = db.prepare(
    `INSERT INTO learning_materials (slug, title, category, summary, content_points, video_url, estimated_minutes, points_reward, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const matIds: number[] = [];
  for (const m of materials) {
    matIds.push(Number(insertMat.run(...m).lastInsertRowid));
  }

  // Seed Quiz Questions (multiple choice, true/false, image_guess)
  const insertQuiz = db.prepare(
    `INSERT INTO quiz_questions (material_id, question_type, question, image_hint, options_json, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertQuiz.run(
    matIds[1],
    'multiple_choice',
    'Senyawa alami pada frass Black Soldier Fly (BSF) yang membantu ketahanan tanaman terhadap patogen adalah?',
    '',
    JSON.stringify(['Kitin', 'Klorin', 'Sulfat sintetis', 'Polimer plastik']),
    'Kitin',
    'Frass BSF mengandung kitin dari kulit larva yang merangsang sistem pertahanan alami tanaman.'
  );
  insertQuiz.run(
    matIds[2],
    'multiple_choice',
    'Hormon tumbuh alami yang banyak ditemukan pada ekstrak daun kelor (Moringa oleifera) adalah?',
    '',
    JSON.stringify(['Zeatin (Sitokinin)', 'Amonia cair', 'Herbisida', 'Formalin']),
    'Zeatin (Sitokinin)',
    'Daun kelor kaya zeatin, salah satu jenis sitokinin alami yang mempercepat pertumbuhan tunas dan akar.'
  );
  insertQuiz.run(
    matIds[7],
    'true_false',
    'Benar atau Salah: Dosis tabur anjuran MORIFRASS adalah 100–200 g/m² setiap 2–4 minggu.',
    '',
    JSON.stringify(['Benar', 'Salah']),
    'Benar',
    'Sesuai panduan pada kemasan belakang MORIFRASS 1 kg, dosis anjuran adalah 100–200 g/m² diaduk dengan tanah tiap 2–4 minggu.'
  );
  insertQuiz.run(
    matIds[3],
    'image_guess',
    'Perhatikan foto kemasan MORIFRASS: Komponen berpori dari pembakaran sekam padi tanpa oksigen berlebih yang menjaga kelembaban tanah disebut?',
    '/assets/aistudio/image_817a15a9.png',
    JSON.stringify(['Biochar sekam padi', 'Pasir silika', 'Batu kapur', 'Urea granul']),
    'Biochar sekam padi',
    'Biochar sekam padi menyimpan air dan menjadi habitat mikroba baik di dalam formulasi MORIFRASS.'
  );
  insertQuiz.run(
    matIds[4],
    'multiple_choice',
    'Urutan konsep utama ekosistem MORIFRASS yang benar adalah?',
    '',
    JSON.stringify([
      'INTEGRATE – PRODUCE – TRACE – MARKET – EDUCATE',
      'BUY – SELL – FORGET',
      'EXTRACT – BURN – DISCARD',
      'IMPORT – REPACK – SELL'
    ]),
    'INTEGRATE – PRODUCE – TRACE – MARKET – EDUCATE',
    'MORIFRASS mengintegrasikan pemasok, produksi, ketertelusuran QR/Blockchain, marketplace, dan edukasi.'
  );

  // 8. Seed Missions
  const insertMission = db.prepare(
    `INSERT INTO missions (code, title, mission_type, action_key, target_count, points_reward, description) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const mis1 = Number(insertMission.run('DAILY_READ', 'Baca 1 Artikel MORI-EDU', 'daily', 'read_article', 1, 10, 'Selesaikan membaca 1 modul edukasi pertanian organik.').lastInsertRowid);
  const mis2 = Number(insertMission.run('DAILY_VIDEO', 'Tonton Video Pembelajaran', 'daily', 'watch_video', 1, 15, 'Tonton materi video agritech hingga selesai.').lastInsertRowid);
  const mis3 = Number(insertMission.run('DAILY_QUIZ', 'Lulus Kuis Skor >= 80', 'daily', 'pass_quiz', 1, 30, 'Selesaikan kuis MORI-QUIZ dengan nilai minimal 80%.').lastInsertRowid);
  const mis4 = Number(insertMission.run('WEEKLY_CATEGORY', 'Selesaikan 3 Materi Belajar', 'weekly', 'complete_3_articles', 3, 40, 'Kuasai 3 modul pembelajaran di MORI-LEARN minggu ini.').lastInsertRowid);
  const mis5 = Number(insertMission.run('WEEKLY_CHALLENGE', 'Tantangan Mingguan Sirkular', 'weekly', 'weekly_explorer', 2, 50, 'Lakukan scan QR batch di MORI-CHAIN & selesaikan kuis.').lastInsertRowid);

  // Pre-seed some progress for demo customer
  db.prepare(`INSERT INTO learning_progress (user_id, material_id, article_completed, video_watched, completed_at) VALUES (?, ?, 1, 1, datetime('now'))`).run(customerId, matIds[0]);
  db.prepare(`INSERT INTO user_missions (user_id, mission_id, progress_count, completed, claimed) VALUES (?, ?, 1, 1, 1)`).run(customerId, mis1);
  db.prepare(`INSERT INTO user_missions (user_id, mission_id, progress_count, completed, claimed) VALUES (?, ?, 1, 1, 0)`).run(customerId, mis2);

  // Badges for demo customer & customer2
  db.prepare(`INSERT INTO user_badges (user_id, badge_code, badge_name, description) VALUES (?, 'ECO_LEARNER', 'Eco Learner', 'Menyelesaikan modul pertama di MORI-LEARN')`).run(customerId);
  db.prepare(`INSERT INTO user_badges (user_id, badge_code, badge_name, description) VALUES (?, 'BSF_MASTER', 'BSF Knowledge Master', 'Lulus kuis BSF & Ekonomi Sirkular')`).run(customer2Id);
  db.prepare(`INSERT INTO user_badges (user_id, badge_code, badge_name, description) VALUES (?, 'ORGANIC_EXPERT', 'Organic Fertilizer Expert', 'Menyelesaikan 3+ materi agronomi organik')`).run(customer2Id);

  // Point Transactions
  const insertPt = db.prepare(`INSERT INTO point_transactions (user_id, amount, tx_type, source, description) VALUES (?, ?, ?, ?, ?)`);
  insertPt.run(customerId, 40, 'earn', 'MORI-LEARN', 'Menyelesaikan modul Pengenalan Pupuk Organik & Misi Harian');
  insertPt.run(customerId, 280, 'earn', 'MORI-QUIZ', 'Bonus kuis agritech & tantangan mingguan (Simulasi)');
  insertPt.run(customerId, -100, 'redeem', 'MORI-REWARDS', 'Penukaran Voucher Gratis Ongkir');

  // 9. Seed Rewards (100 pts = Free shipping, 150 pts = Rp5.000, 250 pts = Rp10.000)
  const insertReward = db.prepare(
    `INSERT INTO rewards (code, title, reward_type, points_cost, discount_amount, max_subsidy, min_purchase, quota, remaining_quota, valid_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const rw1 = Number(insertReward.run('RW-ONGKIR-100', 'Voucher Gratis Ongkir (Subsidi s/d Rp15.000)', 'free_shipping', 100, 0, 15000, 35000, 200, 198, 30).lastInsertRowid);
  insertReward.run('RW-DISC-5K', 'Voucher Diskon Rp5.000', 'discount_fixed', 150, 5000, 0, 35000, 200, 199, 30);
  insertReward.run('RW-DISC-10K', 'Voucher Diskon Rp10.000', 'discount_fixed', 250, 10000, 0, 90000, 150, 150, 30);

  // Pre-seed 1 active voucher for demo customer so they can immediately test checkout voucher!
  const expDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
  const vcId = Number(
    db
      .prepare(
        `INSERT INTO voucher_codes (code, reward_id, user_id, reward_type, discount_amount, max_subsidy, min_purchase, expires_at, is_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .run('MORI-ONGKIR-DEMO', rw1, customerId, 'free_shipping', 0, 15000, 35000, expDate).lastInsertRowid
  );
  db.prepare(`INSERT INTO voucher_redemptions (voucher_id, user_id, reward_id, points_spent) VALUES (?, ?, ?, ?)`).run(vcId, customerId, rw1, 100);

  // 10. Notifications
  db.prepare(`INSERT INTO notifications (user_id, title, message, category) VALUES (?, ?, ?, ?)`).run(
    customerId,
    'Voucher Gratis Ongkir Siap Dipakai',
    'Kode MORI-ONGKIR-DEMO aktif di akun MORI-MARKET Anda untuk potongan ongkir hingga Rp15.000.',
    'reward'
  );
  db.prepare(`INSERT INTO notifications (user_id, title, message, category) VALUES (?, ?, ?, ?)`).run(
    customerId,
    'Pesanan ORD-MF-261108 Dalam Pengiriman',
    'Paket Anda sedang dikirim menggunakan J&T Express (Resi: JT-MF-330192).',
    'order'
  );
}
