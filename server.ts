import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  createAuthToken,
  verifyAuthToken,
  createLedgerHash,
} from './src/server/db.ts';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; email: string; role: 'customer' | 'supplier' | 'petani_kelor' | 'supplier_bsf' | 'admin' | 'distributor' };
    }
  }
}

function authMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const decoded = verifyAuthToken(token);
    if (decoded) {
      req.user = decoded as Express.Request['user'];
    }
  }
  next();
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk melanjutkan.' });
    return;
  }
  next();
}

function requireRoles(...roles: Array<'customer' | 'supplier' | 'petani_kelor' | 'supplier_bsf' | 'admin' | 'distributor'>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk modul ini.' });
      return;
    }
    next();
  };
}

function recalculateLevel(userId: number) {
  const profile = db.prepare(`SELECT points_total FROM user_profiles WHERE user_id = ?`).get(userId) as
    | { points_total: number }
    | undefined;
  if (!profile) return;
  const level = db
    .prepare(`SELECT id FROM user_levels WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1`)
    .get(profile.points_total) as { id: number } | undefined;
  if (level) {
    db.prepare(`UPDATE user_profiles SET level_id = ? WHERE user_id = ?`).run(level.id, userId);
  }
}

function awardPoints(userId: number, amount: number, source: string, description: string) {
  if (amount <= 0) return;
  db.prepare(
    `UPDATE user_profiles SET points_total = points_total + ?, points_available = points_available + ? WHERE user_id = ?`
  ).run(amount, amount, userId);
  db.prepare(`INSERT INTO point_transactions (user_id, amount, tx_type, source, description) VALUES (?, ?, 'earn', ?, ?)`).run(
    userId,
    amount,
    source,
    description
  );
  recalculateLevel(userId);
}

function unlockBadge(userId: number, code: string, name: string, description: string) {
  db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_code, badge_name, description) VALUES (?, ?, ?, ?)`).run(
    userId,
    code,
    name,
    description
  );
}

function addNotification(userId: number, title: string, message: string, category = 'system') {
  db.prepare(`INSERT INTO notifications (user_id, title, message, category) VALUES (?, ?, ?, ?)`).run(
    userId,
    title,
    message,
    category
  );
}

function bumpMission(userId: number, actionKey: string, increment = 1) {
  const mission = db.prepare(`SELECT * FROM missions WHERE action_key = ?`).get(actionKey) as
    | { id: number; target_count: number; points_reward: number; title: string }
    | undefined;
  if (!mission) return;

  const existing = db.prepare(`SELECT * FROM user_missions WHERE user_id = ? AND mission_id = ?`).get(userId, mission.id) as
    | { id: number; progress_count: number; completed: number; claimed: number }
    | undefined;

  if (!existing) {
    const newProg = Math.min(mission.target_count, increment);
    const done = newProg >= mission.target_count ? 1 : 0;
    db.prepare(
      `INSERT INTO user_missions (user_id, mission_id, progress_count, completed, claimed) VALUES (?, ?, ?, ?, 0)`
    ).run(userId, mission.id, newProg, done);
  } else if (!existing.completed) {
    const newProg = Math.min(mission.target_count, existing.progress_count + increment);
    const done = newProg >= mission.target_count ? 1 : 0;
    db.prepare(`UPDATE user_missions SET progress_count = ?, completed = ?, updated_at = datetime('now') WHERE id = ?`).run(
      newProg,
      done,
      existing.id
    );
  }
}

async function startServer() {
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(authMiddleware);

  // ==========================================
  // 1. AUTH & PROFILE ROUTES
  // ==========================================
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }
    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(String(email).trim().toLowerCase()) as
      | { id: number; email: string; password_hash: string; role: string }
      | undefined;

    if (!user || !verifyPassword(String(password), user.password_hash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }

    const token = createAuthToken({ userId: user.id, email: user.email, role: user.role });
    const profile = db
      .prepare(
        `SELECT up.*, ul.level_number, ul.name as level_name, ul.min_points
         FROM user_profiles up
         LEFT JOIN user_levels ul ON up.level_id = ul.id
         WHERE up.user_id = ?`
      )
      .get(user.id);

    res.json({ token, user: { id: user.id, email: user.email, role: user.role, profile } });
  });

  app.post('/api/auth/register', (req, res) => {
    const { email, password, fullName, phone, city, address, role, companyName, supplierCategory } = req.body || {};
    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail);
    if (exists) {
      res.status(409).json({ error: 'Email sudah terdaftar.' });
      return;
    }

    const safeRole = ['petani_kelor', 'supplier_bsf', 'supplier'].includes(role) ? role : 'customer';
    const userId = Number(
      db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`).run(cleanEmail, hashPassword(String(password)), safeRole)
        .lastInsertRowid
    );

    const level1 = db.prepare(`SELECT id FROM user_levels WHERE level_number = 1`).get() as { id: number };
    db.prepare(
      `INSERT INTO user_profiles (user_id, full_name, phone, address, city, level_id, is_simulation) VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(userId, String(fullName), String(phone || ''), String(address || ''), String(city || ''), level1.id);

    if (safeRole === 'supplier' || safeRole === 'petani_kelor' || safeRole === 'supplier_bsf') {
      const sType = safeRole === 'petani_kelor' ? 'petani_kelor' : safeRole === 'supplier_bsf' ? 'supplier_bsf' : 'umum';
      const cat =
        safeRole === 'petani_kelor'
          ? 'Petani Daun Kelor'
          : safeRole === 'supplier_bsf'
            ? 'Peternak BSF'
            : supplierCategory || 'Peternak BSF';
      db.prepare(
        `INSERT INTO suppliers (user_id, company_name, supplier_type, category, contact_name, phone, location, verified_status, is_simulation)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Verifikasi', 0)`
      ).run(userId, String(companyName || fullName), sType, cat, String(fullName), String(phone || '-'), String(city || 'Indonesia'));
    }

    addNotification(userId, 'Selamat Datang di MORIFRASS', 'Akun Anda aktif. Jelajahi MORI-MARKET, MORI-CHAIN, atau kumpulkan poin di MORI-EDU.', 'system');

    const token = createAuthToken({ userId, email: cleanEmail, role: safeRole });
    const profile = db
      .prepare(
        `SELECT up.*, ul.level_number, ul.name as level_name
         FROM user_profiles up LEFT JOIN user_levels ul ON up.level_id = ul.id WHERE up.user_id = ?`
      )
      .get(userId);
    res.status(201).json({ token, user: { id: userId, email: cleanEmail, role: safeRole, profile } });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = db.prepare(`SELECT id, email, role, created_at FROM users WHERE id = ?`).get(req.user!.userId) as
      | { id: number; email: string; role: string }
      | undefined;
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const profile = db
      .prepare(
        `SELECT up.*, ul.level_number, ul.name as level_name, ul.min_points
         FROM user_profiles up LEFT JOIN user_levels ul ON up.level_id = ul.id WHERE up.user_id = ?`
      )
      .get(user.id);
    const badges = db.prepare(`SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`).all(user.id);
    const vouchers = db
      .prepare(
        `SELECT vc.*, r.title as reward_title FROM voucher_codes vc
         JOIN rewards r ON vc.reward_id = r.id
         WHERE vc.user_id = ? ORDER BY vc.is_used ASC, vc.created_at DESC`
      )
      .all(user.id);
    const notifications = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).all(user.id);
    res.json({ user: { ...user, profile, badges, vouchers, notifications } });
  });

  app.patch('/api/profile', requireAuth, (req, res) => {
    const { fullName, phone, address, city, leaderboardAnonymous } = req.body || {};
    db.prepare(
      `UPDATE user_profiles SET
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        leaderboard_anonymous = COALESCE(?, leaderboard_anonymous)
       WHERE user_id = ?`
    ).run(
      fullName ?? null,
      phone ?? null,
      address ?? null,
      city ?? null,
      typeof leaderboardAnonymous === 'boolean' ? (leaderboardAnonymous ? 1 : 0) : null,
      req.user!.userId
    );
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user!.userId);
    res.json({ ok: true });
  });

  // ==========================================
  // 2. MORI-MARKET (Single Product 1 kg + 3 Bundles + Orders + Reviews)
  // ==========================================
  app.get('/api/market', (_req, res) => {
    const product = db.prepare(`SELECT * FROM products WHERE is_active = 1 LIMIT 1`).get() as Record<string, unknown> | undefined;
    const price = product
      ? (db.prepare(`SELECT unit_price FROM product_prices WHERE product_id = ? ORDER BY id DESC LIMIT 1`).get(product.id as number) as { unit_price: number })
      : { unit_price: 35000 };
    const bundles = product
      ? db.prepare(`SELECT * FROM product_bundles WHERE product_id = ? ORDER BY sort_order ASC`).all(product.id as number)
      : [];
    const stock = product
      ? (db.prepare(`SELECT quantity FROM inventory WHERE item_type = 'finished_good' AND ref_id = ?`).get(product.id as number) as { quantity: number } | undefined)
      : { quantity: 0 };

    const soldStats = db
      .prepare(`SELECT COALESCE(SUM(total_items), 0) as total_sold FROM orders WHERE status != 'Menunggu pembayaran'`)
      .get() as { total_sold: number };

    const reviews = db
      .prepare(
        `SELECT r.*, up.full_name as reviewer_name, up.city as reviewer_city
         FROM reviews r
         JOIN user_profiles up ON r.user_id = up.user_id
         ORDER BY r.created_at DESC`
      )
      .all() as Array<{ rating: number }>;

    const avgRating = reviews.length > 0 ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : 4.9;
    const latestBatch = db
      .prepare(
        `SELECT pb.batch_code, qt.status as qc_status
         FROM production_batches pb
         LEFT JOIN quality_tests qt ON qt.batch_id = pb.id
         ORDER BY pb.id DESC LIMIT 1`
      )
      .get();

    res.json({
      product: { ...product, unit_price: price.unit_price, stock: stock?.quantity ?? 0, total_sold: soldStats.total_sold, avg_rating: avgRating, review_count: reviews.length },
      bundles,
      reviews,
      latestBatch,
    });
  });

  app.put('/api/admin/bundles/:id', requireRoles('admin'), (req, res) => {
    const bundleId = Number(req.params.id);
    const { name, quantity_units, normal_price, bundle_price, description } = req.body || {};
    const existing = db.prepare(`SELECT * FROM product_bundles WHERE id = ?`).get(bundleId) as
      | { id: number; name: string; quantity_units: number; normal_price: number; bundle_price: number; description: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Paket tidak ditemukan.' });
      return;
    }
    const qty = Number(quantity_units ?? existing.quantity_units);
    const normal = Number(normal_price ?? existing.normal_price);
    const bPrice = Number(bundle_price ?? existing.bundle_price);
    const disc = Math.max(0, normal - bPrice);

    db.prepare(
      `UPDATE product_bundles SET name = ?, quantity_units = ?, normal_price = ?, bundle_price = ?, discount_amount = ?, description = ? WHERE id = ?`
    ).run(String(name ?? existing.name), qty, normal, bPrice, disc, String(description ?? existing.description), bundleId);

    res.json({ ok: true });
  });

  app.post('/api/orders/validate-voucher', requireAuth, (req, res) => {
    const { code, subtotal, shippingCost } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Masukkan kode voucher.' });
      return;
    }
    const voucher = db
      .prepare(`SELECT * FROM voucher_codes WHERE code = ? AND user_id = ?`)
      .get(String(code).trim().toUpperCase(), req.user!.userId) as
      | {
          id: number;
          code: string;
          reward_type: string;
          discount_amount: number;
          max_subsidy: number;
          min_purchase: number;
          expires_at: string;
          is_used: number;
        }
      | undefined;

    if (!voucher) {
      res.status(404).json({ error: 'Voucher tidak ditemukan di akun Anda.' });
      return;
    }
    if (voucher.is_used) {
      res.status(400).json({ error: 'Voucher sudah pernah digunakan.' });
      return;
    }
    if (new Date(voucher.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Masa berlaku voucher sudah habis.' });
      return;
    }
    if (Number(subtotal) < voucher.min_purchase) {
      res.status(400).json({ error: `Minimum pembelian untuk voucher ini adalah Rp${voucher.min_purchase.toLocaleString('id-ID')}.` });
      return;
    }

    const voucherDiscount = voucher.reward_type === 'discount_fixed' ? Math.min(Number(subtotal), voucher.discount_amount) : 0;
    const shippingDiscount = voucher.reward_type === 'free_shipping' ? Math.min(Number(shippingCost || 0), voucher.max_subsidy) : 0;

    res.json({ valid: true, voucher, voucherDiscount, shippingDiscount });
  });

  app.post('/api/orders', requireAuth, (req, res) => {
    const { items, voucherCode, courier, shippingService, shippingCost, recipientName, phone, address, city, paymentMethod } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Keranjang belanja masih kosong.' });
      return;
    }
    if (!recipientName || !phone || !address || !city) {
      res.status(400).json({ error: 'Lengkapi alamat dan data penerima pengiriman.' });
      return;
    }

    let subtotalNormal = 0;
    let totalBundlePrice = 0;
    let totalUnits = 0;
    const resolvedItems: Array<{ bundleId: number; name: string; units: number; qty: number; bundlePrice: number; lineTotal: number }> = [];

    for (const item of items) {
      const b = db.prepare(`SELECT * FROM product_bundles WHERE id = ?`).get(Number(item.bundleId)) as
        | { id: number; name: string; quantity_units: number; normal_price: number; bundle_price: number }
        | undefined;
      const qty = Math.max(1, Number(item.quantity || 1));
      if (!b) {
        res.status(400).json({ error: 'Paket pembelian tidak valid.' });
        return;
      }
      subtotalNormal += b.normal_price * qty;
      totalBundlePrice += b.bundle_price * qty;
      totalUnits += b.quantity_units * qty;
      resolvedItems.push({
        bundleId: b.id,
        name: b.name,
        units: b.quantity_units,
        qty,
        bundlePrice: b.bundle_price,
        lineTotal: b.bundle_price * qty,
      });
    }

    // Check finished stock
    const inv = db.prepare(`SELECT id, quantity FROM inventory WHERE item_type = 'finished_good' LIMIT 1`).get() as
      | { id: number; quantity: number }
      | undefined;
    if (!inv || inv.quantity < totalUnits) {
      res.status(400).json({ error: `Stok kemasan 1 kg tidak mencukupi (tersedia: ${inv?.quantity ?? 0} kemasan).` });
      return;
    }

    const bundleDiscount = Math.max(0, subtotalNormal - totalBundlePrice);
    const shipCost = Math.max(0, Number(shippingCost ?? 15000));
    let voucherDiscount = 0;
    let shippingDiscount = 0;
    let usedVoucherId: number | null = null;
    let cleanVoucherCode: string | null = null;

    if (voucherCode) {
      const vc = db
        .prepare(`SELECT * FROM voucher_codes WHERE code = ? AND user_id = ?`)
        .get(String(voucherCode).trim().toUpperCase(), req.user!.userId) as
        | { id: number; code: string; reward_type: string; discount_amount: number; max_subsidy: number; min_purchase: number; expires_at: string; is_used: number }
        | undefined;
      if (!vc || vc.is_used || new Date(vc.expires_at).getTime() < Date.now() || totalBundlePrice < vc.min_purchase) {
        res.status(400).json({ error: 'Voucher tidak valid atau tidak memenuhi syarat.' });
        return;
      }
      usedVoucherId = vc.id;
      cleanVoucherCode = vc.code;
      if (vc.reward_type === 'discount_fixed') voucherDiscount = Math.min(totalBundlePrice, vc.discount_amount);
      if (vc.reward_type === 'free_shipping') shippingDiscount = Math.min(shipCost, vc.max_subsidy);
    }

    const grandTotal = Math.max(0, totalBundlePrice - voucherDiscount + shipCost - shippingDiscount);
    const orderCode = `ORD-MF-${Date.now().toString().slice(-6)}`;
    const validPayment = ['Transfer Bank', 'QRIS', 'E-Wallet', 'Pembayaran Manual Prototype'].includes(paymentMethod)
      ? paymentMethod
      : 'Pembayaran Manual Prototype';

    const orderId = Number(
      db
        .prepare(
          `INSERT INTO orders (order_code, user_id, total_items, subtotal, bundle_discount, voucher_code, voucher_discount, shipping_cost, shipping_discount, grand_total, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu pembayaran')`
        )
        .run(
          orderCode,
          req.user!.userId,
          totalUnits,
          subtotalNormal,
          bundleDiscount,
          cleanVoucherCode,
          voucherDiscount,
          shipCost,
          shippingDiscount,
          grandTotal
        ).lastInsertRowid
    );

    const insertDetail = db.prepare(
      `INSERT INTO order_details (order_id, bundle_id, bundle_name, units_per_bundle, quantity_bundles, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ri of resolvedItems) {
      insertDetail.run(orderId, ri.bundleId, ri.name, ri.units, ri.qty, ri.bundlePrice, ri.lineTotal);
    }

    const refCode = `SIM-${validPayment.slice(0, 4).toUpperCase()}-${crypto.randomInt(10000, 99999)}`;
    db.prepare(
      `INSERT INTO payments (order_id, method, status, reference_code, is_prototype_simulation) VALUES (?, ?, 'Menunggu Konfirmasi', ?, 1)`
    ).run(orderId, validPayment, refCode);

    db.prepare(
      `INSERT INTO shipping (order_id, courier, service_name, recipient_name, phone, address, city, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Pengemasan')`
    ).run(orderId, String(courier || 'JNE Cargo'), String(shippingService || 'Reguler'), String(recipientName), String(phone), String(address), String(city));

    // Deduct stock
    db.prepare(`UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?`).run(totalUnits, inv.id);

    // Mark voucher used
    if (usedVoucherId) {
      db.prepare(`UPDATE voucher_codes SET is_used = 1, used_order_id = ? WHERE id = ?`).run(orderId, usedVoucherId);
      addNotification(
        req.user!.userId,
        'Voucher MORI-EDU Terpakai',
        `Voucher ${cleanVoucherCode} berhasil diterapkan pada pesanan ${orderCode}.`,
        'reward'
      );
    }

    addNotification(
      req.user!.userId,
      `Pesanan ${orderCode} Dibuat`,
      `Metode ${validPayment} (${refCode}). Menunggu verifikasi konfirmasi pembayaran prototype.`,
      'order'
    );

    res.status(201).json({ orderId, orderCode, grandTotal, paymentRef: refCode });
  });

  app.get('/api/orders', requireAuth, (req, res) => {
    const isAdminOrDist = req.user!.role === 'admin' || req.user!.role === 'distributor';
    const rows = isAdminOrDist
      ? db
          .prepare(
            `SELECT o.*, up.full_name as customer_name, p.method as payment_method, p.status as payment_status, p.reference_code,
                    s.courier, s.service_name, s.tracking_number, s.recipient_name, s.address, s.city, s.status as shipping_status
             FROM orders o
             JOIN user_profiles up ON o.user_id = up.user_id
             LEFT JOIN payments p ON p.order_id = o.id
             LEFT JOIN shipping s ON s.order_id = o.id
             ORDER BY o.created_at DESC`
          )
          .all()
      : db
          .prepare(
            `SELECT o.*, p.method as payment_method, p.status as payment_status, p.reference_code,
                    s.courier, s.service_name, s.tracking_number, s.recipient_name, s.address, s.city, s.status as shipping_status
             FROM orders o
             LEFT JOIN payments p ON p.order_id = o.id
             LEFT JOIN shipping s ON s.order_id = o.id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`
          )
          .all(req.user!.userId);

    const detailsStmt = db.prepare(`SELECT * FROM order_details WHERE order_id = ?`);
    const reviewStmt = db.prepare(`SELECT id FROM reviews WHERE order_id = ? AND user_id = ?`);
    const orders = rows.map((o: any) => ({
      ...o,
      items: detailsStmt.all(o.id),
      has_reviewed: !!reviewStmt.get(o.id, o.user_id),
    }));
    res.json({ orders });
  });

  app.patch('/api/orders/:id/status', requireRoles('admin', 'distributor'), (req, res) => {
    const orderId = Number(req.params.id);
    const { status, trackingNumber } = req.body || {};
    const allowed = ['Menunggu pembayaran', 'Pembayaran dikonfirmasi', 'Diproses', 'Dikemas', 'Dalam pengiriman', 'Selesai'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Status pesanan tidak valid.' });
      return;
    }

    if (req.user!.role === 'distributor' && !['Dalam pengiriman', 'Selesai'].includes(status)) {
      res.status(403).json({ error: 'Distributor hanya dapat memperbarui status pengiriman dan selesai.' });
      return;
    }

    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as { id: number; user_id: number; order_code: string } | undefined;
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, orderId);

    if (status === 'Pembayaran dikonfirmasi') {
      db.prepare(`UPDATE payments SET status = 'Terkonfirmasi', paid_at = datetime('now') WHERE order_id = ?`).run(orderId);
    }
    if (status === 'Dalam pengiriman') {
      db.prepare(
        `UPDATE shipping SET status = 'Dalam Pengiriman', tracking_number = COALESCE(NULLIF(?, ''), tracking_number), distributor_id = ?, updated_at = datetime('now') WHERE order_id = ?`
      ).run(String(trackingNumber || ''), req.user!.userId, orderId);
    }
    if (status === 'Selesai') {
      db.prepare(`UPDATE shipping SET status = 'Terkirim', updated_at = datetime('now') WHERE order_id = ?`).run(orderId);
    }

    addNotification(order.user_id, `Update Pesanan ${order.order_code}`, `Status pesanan berubah menjadi: ${status}.`, 'order');
    res.json({ ok: true });
  });

  app.post('/api/reviews', requireAuth, (req, res) => {
    const { orderId, rating, comment, photoUrl } = req.body || {};
    const order = db.prepare(`SELECT * FROM orders WHERE id = ? AND user_id = ?`).get(Number(orderId), req.user!.userId) as
      | { id: number; status: string }
      | undefined;
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    if (order.status !== 'Selesai') {
      res.status(400).json({ error: 'Ulasan hanya dapat diberikan setelah pesanan berstatus Selesai.' });
      return;
    }
    const rVal = Math.min(5, Math.max(1, Number(rating || 5)));
    if (!comment || String(comment).trim().length < 5) {
      res.status(400).json({ error: 'Tuliskan ulasan minimal 5 karakter.' });
      return;
    }

    const product = db.prepare(`SELECT id FROM products LIMIT 1`).get() as { id: number };
    try {
      db.prepare(`INSERT INTO reviews (order_id, user_id, product_id, rating, comment, photo_url) VALUES (?, ?, ?, ?, ?, ?)`).run(
        order.id,
        req.user!.userId,
        product.id,
        rVal,
        String(comment).trim(),
        String(photoUrl || '')
      );
      res.status(201).json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Anda sudah memberikan ulasan untuk pesanan ini.' });
    }
  });

  // ==========================================
  // 3. MORI-CHAIN (QR Code & Simulated Blockchain Traceability)
  // ==========================================
  app.get('/api/trace', (_req, res) => {
    const batches = db
      .prepare(
        `SELECT pb.*, pt.qr_payload, pt.qr_data_url, pt.scan_count, pt.distribution_region, pt.distributor_name, pt.verification_status,
                qt.status as qc_status, qt.ph_level, qt.moisture_pct, qt.npk_summary
         FROM production_batches pb
         LEFT JOIN product_traceability pt ON pt.batch_id = pb.id
         LEFT JOIN quality_tests qt ON qt.batch_id = pb.id
         ORDER BY pb.id DESC`
      )
      .all();
    res.json({ batches });
  });

  app.get('/api/trace/:batchCode', (req, res) => {
    const rawCode = String(req.params.batchCode).replace(/^MORIFRASS:/i, '').trim().toUpperCase();
    const batch = db
      .prepare(
        `SELECT pb.*, p.name as product_name, p.net_weight_kg, p.packaging,
                pt.id as trace_id, pt.qr_payload, pt.qr_data_url, pt.scan_count, pt.distribution_region, pt.distributor_name, pt.verification_status, pt.notes as trace_notes
         FROM production_batches pb
         JOIN products p ON pb.product_id = p.id
         LEFT JOIN product_traceability pt ON pt.batch_id = pb.id
         WHERE UPPER(pb.batch_code) = ?`
      )
      .get(rawCode) as Record<string, any> | undefined;

    if (!batch) {
      res.status(404).json({ error: `Batch "${rawCode}" tidak ditemukan di sistem ketertelusuran MORI-CHAIN.` });
      return;
    }

    db.prepare(`UPDATE product_traceability SET scan_count = scan_count + 1 WHERE batch_id = ?`).run(batch.id);
    if (req.user) {
      bumpMission(req.user.userId, 'weekly_explorer', 1);
    }

    const compositions = db
      .prepare(
        `SELECT bc.*, s.company_name as supplier_name, s.category as supplier_category, s.location as supplier_location, s.verified_status
         FROM batch_compositions bc
         LEFT JOIN suppliers s ON bc.supplier_id = s.id
         WHERE bc.batch_id = ?`
      )
      .all(batch.id);

    const qualityTest = db.prepare(`SELECT * FROM quality_tests WHERE batch_id = ?`).get(batch.id);
    const ledgerRecords = db.prepare(`SELECT * FROM blockchain_ledger_records WHERE batch_id = ? ORDER BY block_number ASC`).all(batch.id);

    res.json({
      passport: {
        ...batch,
        scan_count: (batch.scan_count || 0) + 1,
        compositions,
        qualityTest,
        ledgerRecords,
      },
    });
  });

  app.post('/api/trace/:batchCode/distribution', requireRoles('admin', 'distributor'), (req, res) => {
    const rawCode = String(req.params.batchCode).trim().toUpperCase();
    const { distributionRegion, distributorName, notes } = req.body || {};
    const batch = db.prepare(`SELECT id, batch_code FROM production_batches WHERE UPPER(batch_code) = ?`).get(rawCode) as
      | { id: number; batch_code: string }
      | undefined;
    if (!batch) {
      res.status(404).json({ error: 'Batch tidak ditemukan.' });
      return;
    }

    db.prepare(
      `UPDATE product_traceability SET distribution_region = ?, distributor_name = ?, notes = ?, updated_at = datetime('now') WHERE batch_id = ?`
    ).run(String(distributionRegion || ''), String(distributorName || ''), String(notes || ''), batch.id);

    const lastBlock = db
      .prepare(`SELECT block_number, record_hash FROM blockchain_ledger_records WHERE batch_id = ? ORDER BY block_number DESC LIMIT 1`)
      .get(batch.id) as { block_number: number; record_hash: string } | undefined;

    const prevHash = lastBlock?.record_hash || '0x' + '0'.repeat(64);
    const nextBlock = (lastBlock?.block_number || 1000) + 1;
    const summary = `Distribusi ke ${distributionRegion} oleh ${distributorName}`;
    const newHash = createLedgerHash(`${prevHash}:${summary}:${Date.now()}`);

    db.prepare(
      `INSERT INTO blockchain_ledger_records (batch_id, tx_id, block_number, previous_hash, record_hash, action_type, actor_role, payload_summary, is_simulation)
       VALUES (?, ?, ?, ?, ?, 'DISTRIBUTION_UPDATED', ?, ?, 1)`
    ).run(batch.id, newHash.slice(0, 22), nextBlock, prevHash, newHash, req.user!.role, summary);

    res.json({ ok: true });
  });

  // ==========================================
  // 4. MORI-SUPPLY (B2B Raw Material Procurement Marketplace)
  // ==========================================
  const SUPPLIER_ROLES = ['supplier', 'petani_kelor', 'supplier_bsf', 'admin'] as const;

  app.get('/api/supply', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const suppliers = db
      .prepare(
        `SELECT s.*,
                (SELECT ROUND(AVG(overall_score), 1) FROM supplier_evaluations se WHERE se.supplier_id = s.id) as eval_avg,
                (SELECT COUNT(*) FROM supplier_evaluations se WHERE se.supplier_id = s.id) as eval_count
         FROM suppliers s
         ORDER BY s.id DESC`
      )
      .all();

    const evalStmt = db.prepare(`SELECT * FROM supplier_evaluations WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 5`);
    const enrichedSuppliers = suppliers.map((s: any) => ({ ...s, evaluations: evalStmt.all(s.id) }));

    const materials = db
      .prepare(
        `SELECT rm.*, s.company_name, s.supplier_type, s.category as supplier_category, s.verified_status, s.rating as supplier_rating, s.location as supplier_location, s.phone as supplier_phone
         FROM raw_materials rm
         JOIN suppliers s ON rm.supplier_id = s.id
         ORDER BY rm.id DESC`
      )
      .all();

    const mySupplier = db.prepare(`SELECT * FROM suppliers WHERE user_id = ?`).get(req.user!.userId) as { id: number } | undefined;
    const isAdmin = req.user!.role === 'admin';

    const rfqs = isAdmin
      ? db
          .prepare(
            `SELECT r.*, s.company_name, rm.name as material_name, rm.category as material_category
             FROM raw_material_rfqs r
             JOIN suppliers s ON r.supplier_id = s.id
             JOIN raw_materials rm ON r.raw_material_id = rm.id
             ORDER BY r.created_at DESC`
          )
          .all()
      : mySupplier
        ? db
            .prepare(
              `SELECT r.*, s.company_name, rm.name as material_name, rm.category as material_category
               FROM raw_material_rfqs r
               JOIN suppliers s ON r.supplier_id = s.id
               JOIN raw_materials rm ON r.raw_material_id = rm.id
               WHERE r.supplier_id = ?
               ORDER BY r.created_at DESC`
            )
            .all(mySupplier.id)
        : [];

    const txRows = isAdmin
      ? db
          .prepare(
            `SELECT rmt.*, s.company_name, s.location as supplier_location, rm.name as material_name, rm.category as material_category, rm.unit
             FROM raw_material_transactions rmt
             JOIN suppliers s ON rmt.supplier_id = s.id
             JOIN raw_materials rm ON rmt.raw_material_id = rm.id
             ORDER BY rmt.created_at DESC`
          )
          .all()
      : mySupplier
        ? db
            .prepare(
              `SELECT rmt.*, s.company_name, s.location as supplier_location, rm.name as material_name, rm.category as material_category, rm.unit
               FROM raw_material_transactions rmt
               JOIN suppliers s ON rmt.supplier_id = s.id
               JOIN raw_materials rm ON rmt.raw_material_id = rm.id
               WHERE rmt.supplier_id = ?
               ORDER BY rmt.created_at DESC`
            )
            .all(mySupplier.id)
        : [];

    const inspStmt = db.prepare(`SELECT * FROM raw_material_inspections WHERE transaction_id = ?`);
    const transactions = txRows.map((tx: any) => ({
      ...tx,
      inspection: inspStmt.get(tx.id) || null,
    }));

    res.json({ suppliers: enrichedSuppliers, materials, rfqs, transactions, mySupplier });
  });

  app.patch('/api/supply/profile', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const { companyName, contactName, phone, location, description } = req.body || {};
    const mySupplier = db.prepare(`SELECT * FROM suppliers WHERE user_id = ?`).get(req.user!.userId) as { id: number } | undefined;
    if (!mySupplier) {
      res.status(404).json({ error: 'Profil pemasok tidak ditemukan untuk akun ini.' });
      return;
    }
    db.prepare(
      `UPDATE suppliers SET
        company_name = COALESCE(?, company_name),
        contact_name = COALESCE(?, contact_name),
        phone = COALESCE(?, phone),
        location = COALESCE(?, location),
        description = COALESCE(?, description)
       WHERE id = ?`
    ).run(companyName ?? null, contactName ?? null, phone ?? null, location ?? null, description ?? null, mySupplier.id);
    res.json({ ok: true });
  });

  app.post('/api/supply/materials', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const {
      supplierId,
      name,
      category,
      unit,
      pricePerUnit,
      stockAvailable,
      originRegion,
      description,
      specifications,
      photoUrl,
      estimatedDelivery,
      qualityDocName,
      qualityDocUrl,
    } = req.body || {};

    let targetSupplierId = Number(supplierId);
    if (req.user!.role !== 'admin') {
      const own = db.prepare(`SELECT id FROM suppliers WHERE user_id = ?`).get(req.user!.userId) as { id: number } | undefined;
      if (!own) {
        res.status(400).json({ error: 'Profil pemasok belum terdaftar.' });
        return;
      }
      targetSupplierId = own.id;
    }

    if (req.user!.role === 'petani_kelor' && !['Daun Kelor Segar', 'Daun Kelor Kering'].includes(category)) {
      res.status(400).json({ error: 'Akun Petani Kelor hanya dapat menawarkan Daun Kelor Segar atau Daun Kelor Kering.' });
      return;
    }
    if (req.user!.role === 'supplier_bsf' && !['Maggot BSF Kering', 'Frass BSF'].includes(category)) {
      res.status(400).json({ error: 'Akun Supplier BSF hanya dapat menawarkan Maggot BSF Kering atau Frass BSF.' });
      return;
    }

    if (!targetSupplierId || !name || !pricePerUnit) {
      res.status(400).json({ error: 'Lengkapi nama produk, kategori, dan harga per kg.' });
      return;
    }

    const approval = req.user!.role === 'admin' ? 'Disetujui' : 'Menunggu Persetujuan';
    const id = Number(
      db
        .prepare(
          `INSERT INTO raw_materials (
            supplier_id, name, category, unit, price_per_unit, stock_available, origin_region,
            description, specifications, photo_url, estimated_delivery, quality_doc_name, quality_doc_url, is_active, approval_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
        )
        .run(
          targetSupplierId,
          String(name),
          String(category || 'Frass BSF'),
          String(unit || 'kg'),
          Number(pricePerUnit),
          Number(stockAvailable || 0),
          String(originRegion || 'Jawa Timur'),
          String(description || ''),
          String(specifications || ''),
          String(photoUrl || ''),
          String(estimatedDelivery || '2–3 hari kerja'),
          String(qualityDocName || ''),
          String(qualityDocUrl || ''),
          approval
        ).lastInsertRowid
    );
    res.status(201).json({ id, approval_status: approval });
  });

  app.put('/api/supply/materials/:id', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const matId = Number(req.params.id);
    const mat = db.prepare(`SELECT rm.*, s.user_id FROM raw_materials rm JOIN suppliers s ON rm.supplier_id = s.id WHERE rm.id = ?`).get(matId) as
      | any
      | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Penawaran bahan baku tidak ditemukan.' });
      return;
    }
    if (req.user!.role !== 'admin' && mat.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Anda tidak berhak mengubah penawaran pemasok lain.' });
      return;
    }

    const {
      name,
      category,
      pricePerUnit,
      stockAvailable,
      originRegion,
      description,
      specifications,
      photoUrl,
      estimatedDelivery,
      qualityDocName,
      qualityDocUrl,
      isActive,
      approvalStatus,
    } = req.body || {};

    const nextApproval =
      req.user!.role === 'admin' && ['Menunggu Persetujuan', 'Disetujui', 'Ditolak'].includes(approvalStatus)
        ? approvalStatus
        : mat.approval_status;

    db.prepare(
      `UPDATE raw_materials SET
        name = ?, category = ?, price_per_unit = ?, stock_available = ?, origin_region = ?,
        description = ?, specifications = ?, photo_url = ?, estimated_delivery = ?,
        quality_doc_name = ?, quality_doc_url = ?, is_active = ?, approval_status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name ?? mat.name,
      category ?? mat.category,
      Number(pricePerUnit ?? mat.price_per_unit),
      Number(stockAvailable ?? mat.stock_available),
      originRegion ?? mat.origin_region,
      description ?? mat.description,
      specifications ?? mat.specifications,
      photoUrl !== undefined ? String(photoUrl) : mat.photo_url,
      estimatedDelivery ?? mat.estimated_delivery,
      qualityDocName !== undefined ? String(qualityDocName) : mat.quality_doc_name,
      qualityDocUrl !== undefined ? String(qualityDocUrl) : mat.quality_doc_url,
      typeof isActive === 'boolean' ? (isActive ? 1 : 0) : mat.is_active,
      nextApproval,
      matId
    );
    res.json({ ok: true });
  });

  app.delete('/api/supply/materials/:id', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const matId = Number(req.params.id);
    const mat = db.prepare(`SELECT rm.id, s.user_id FROM raw_materials rm JOIN suppliers s ON rm.supplier_id = s.id WHERE rm.id = ?`).get(matId) as
      | { id: number; user_id: number | null }
      | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Penawaran tidak ditemukan.' });
      return;
    }
    if (req.user!.role !== 'admin' && mat.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Anda tidak berhak menghapus penawaran pemasok lain.' });
      return;
    }
    db.prepare(`DELETE FROM raw_materials WHERE id = ?`).run(matId);
    res.json({ ok: true });
  });

  app.patch('/api/supply/suppliers/:id/verify', requireRoles('admin'), (req, res) => {
    const sid = Number(req.params.id);
    const { status } = req.body || {};
    const valid = status === 'Terverifikasi' ? 'Terverifikasi' : 'Menunggu Verifikasi';
    db.prepare(`UPDATE suppliers SET verified_status = ? WHERE id = ?`).run(valid, sid);
    res.json({ ok: true });
  });

  // RFQ Routes
  app.post('/api/supply/rfqs', requireRoles('admin'), (req, res) => {
    const { rawMaterialId, quantityKg, targetPricePerKg, deliveryEstimate, notes } = req.body || {};
    const mat = db.prepare(`SELECT * FROM raw_materials WHERE id = ?`).get(Number(rawMaterialId)) as
      | { id: number; supplier_id: number; price_per_unit: number; estimated_delivery: string }
      | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Penawaran bahan baku tidak ditemukan.' });
      return;
    }
    const rfqCode = `RFQ-MF-${Date.now().toString().slice(-6)}`;
    const id = Number(
      db
        .prepare(
          `INSERT INTO raw_material_rfqs (rfq_code, supplier_id, raw_material_id, requested_by_user_id, quantity_kg, target_price_per_kg, delivery_estimate, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu Respon')`
        )
        .run(
          rfqCode,
          mat.supplier_id,
          mat.id,
          req.user!.userId,
          Math.max(1, Number(quantityKg || 50)),
          Math.max(100, Number(targetPricePerKg || mat.price_per_unit)),
          String(deliveryEstimate || mat.estimated_delivery || '2–3 hari kerja'),
          String(notes || '')
        ).lastInsertRowid
    );
    res.status(201).json({ id, rfqCode });
  });

  app.patch('/api/supply/rfqs/:id', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const rfqId = Number(req.params.id);
    const { status, offeredPricePerKg, supplierNotes } = req.body || {};
    const rfq = db
      .prepare(`SELECT r.*, s.user_id FROM raw_material_rfqs r JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?`)
      .get(rfqId) as any | undefined;
    if (!rfq) {
      res.status(404).json({ error: 'RFQ tidak ditemukan.' });
      return;
    }
    if (req.user!.role !== 'admin' && rfq.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    const allowed = ['Menunggu Respon', 'Penawaran Balik', 'Disetujui', 'Ditolak', 'Dikonversi ke PO'];
    if (status && !allowed.includes(status)) {
      res.status(400).json({ error: 'Status RFQ tidak valid.' });
      return;
    }
    db.prepare(
      `UPDATE raw_material_rfqs SET
        status = COALESCE(?, status),
        offered_price_per_kg = COALESCE(?, offered_price_per_kg),
        supplier_notes = COALESCE(?, supplier_notes),
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(status ?? null, offeredPricePerKg !== undefined ? Number(offeredPricePerKg) : null, supplierNotes ?? null, rfqId);
    res.json({ ok: true });
  });

  // Purchase Orders (PO)
  app.post('/api/supply/orders', requireRoles('admin'), (req, res) => {
    const { rawMaterialId, rfqId, quantity, quotePrice, notes } = req.body || {};
    const mat = db.prepare(`SELECT * FROM raw_materials WHERE id = ?`).get(Number(rawMaterialId)) as
      | { id: number; supplier_id: number; price_per_unit: number; stock_available: number; name: string }
      | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Bahan baku tidak ditemukan.' });
      return;
    }
    const qty = Math.max(1, Number(quantity || 1));
    const unitPrice = Number(quotePrice || mat.price_per_unit);
    const total = qty * unitPrice;
    const poCode = `PO-MF-${Date.now().toString().slice(-6)}`;

    const txId = Number(
      db
        .prepare(
          `INSERT INTO raw_material_transactions (po_code, supplier_id, raw_material_id, rfq_id, ordered_by_user_id, quantity, quote_price, total_price, status, payment_status, shipping_status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Dipesan', 'Menunggu Pembayaran', 'Belum Dikirim', ?)`
        )
        .run(poCode, mat.supplier_id, mat.id, rfqId ? Number(rfqId) : null, req.user!.userId, qty, unitPrice, total, String(notes || 'Purchase Order pengadaan MORIFRASS')).lastInsertRowid
    );

    if (rfqId) {
      db.prepare(`UPDATE raw_material_rfqs SET status = 'Dikonversi ke PO', updated_at = datetime('now') WHERE id = ?`).run(Number(rfqId));
    }

    db.prepare(`INSERT INTO raw_material_inspections (transaction_id, status, notes) VALUES (?, 'Menunggu Pemeriksaan', 'Menunggu barang tiba di gudang MORIFRASS.')`).run(txId);
    res.status(201).json({ id: txId, poCode });
  });

  app.patch('/api/supply/orders/:id/status', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const txId = Number(req.params.id);
    const { status, paymentStatus, shippingStatus, trackingNumber, estimatedArrival } = req.body || {};
    const tx = db
      .prepare(`SELECT rmt.*, s.user_id as supplier_user_id FROM raw_material_transactions rmt JOIN suppliers s ON rmt.supplier_id = s.id WHERE rmt.id = ?`)
      .get(txId) as any | undefined;
    if (!tx) {
      res.status(404).json({ error: 'Purchase Order tidak ditemukan.' });
      return;
    }
    if (req.user!.role !== 'admin' && tx.supplier_user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Anda tidak berhak mengubah PO ini.' });
      return;
    }

    const allowedStatus = ['Penawaran', 'Dipesan', 'Diterima Pemasok', 'Ditolak Pemasok', 'Dikirim', 'Diterima'];
    if (status && !allowedStatus.includes(status)) {
      res.status(400).json({ error: 'Status PO tidak valid.' });
      return;
    }

    let nextShipping = shippingStatus || tx.shipping_status;
    if (status === 'Dikirim') nextShipping = 'Dalam Pengiriman';
    if (status === 'Diterima') nextShipping = 'Diterima Gudang';

    const nextPayment = req.user!.role === 'admin' && paymentStatus ? paymentStatus : tx.payment_status;

    db.prepare(
      `UPDATE raw_material_transactions SET
        status = COALESCE(?, status),
        payment_status = ?,
        shipping_status = ?,
        tracking_number = COALESCE(NULLIF(?, ''), tracking_number),
        estimated_arrival = COALESCE(NULLIF(?, ''), estimated_arrival)
       WHERE id = ?`
    ).run(status ?? null, nextPayment, nextShipping, trackingNumber ?? '', estimatedArrival ?? '', txId);

    res.json({ ok: true });
  });

  // D. Raw Material Quality Verification (Admin Only)
  app.put('/api/supply/inspections/:transactionId', requireRoles('admin'), (req, res) => {
    const txId = Number(req.params.transactionId);
    const {
      actualQuantityKg,
      physicalCondition,
      moisturePct,
      cleanlinessStatus,
      labTestSummary,
      labDocName,
      labDocUrl,
      status,
      notes,
    } = req.body || {};

    if (!['Menunggu Pemeriksaan', 'Lolos Pemeriksaan', 'Ditolak'].includes(status)) {
      res.status(400).json({ error: 'Status pemeriksaan bahan baku tidak valid.' });
      return;
    }

    const tx = db
      .prepare(`SELECT rmt.*, rm.name as material_name, rm.unit FROM raw_material_transactions rmt JOIN raw_materials rm ON rmt.raw_material_id = rm.id WHERE rmt.id = ?`)
      .get(txId) as any | undefined;
    if (!tx) {
      res.status(404).json({ error: 'PO tidak ditemukan.' });
      return;
    }

    const prevInsp = db.prepare(`SELECT * FROM raw_material_inspections WHERE transaction_id = ?`).get(txId) as any | undefined;
    const actualQty = actualQuantityKg !== undefined && actualQuantityKg !== '' ? Number(actualQuantityKg) : tx.quantity;

    if (prevInsp) {
      db.prepare(
        `UPDATE raw_material_inspections SET
          actual_quantity_kg = ?, physical_condition = ?, moisture_pct = ?, cleanliness_status = ?,
          lab_test_summary = ?, lab_doc_name = ?, lab_doc_url = ?, status = ?, inspector_email = ?, notes = ?, inspected_at = datetime('now')
         WHERE transaction_id = ?`
      ).run(
        actualQty,
        String(physicalCondition || ''),
        moisturePct !== undefined && moisturePct !== '' ? Number(moisturePct) : null,
        String(cleanlinessStatus || ''),
        String(labTestSummary || ''),
        String(labDocName || ''),
        String(labDocUrl || ''),
        status,
        req.user!.email,
        String(notes || ''),
        txId
      );
    } else {
      db.prepare(
        `INSERT INTO raw_material_inspections (transaction_id, actual_quantity_kg, physical_condition, moisture_pct, cleanliness_status, lab_test_summary, lab_doc_name, lab_doc_url, status, inspector_email, notes, inspected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        txId,
        actualQty,
        String(physicalCondition || ''),
        moisturePct !== undefined && moisturePct !== '' ? Number(moisturePct) : null,
        String(cleanlinessStatus || ''),
        String(labTestSummary || ''),
        String(labDocName || ''),
        String(labDocUrl || ''),
        status,
        req.user!.email,
        String(notes || '')
      );
    }

    // ONLY add to production inventory when verified Lolos Pemeriksaan!
    if (status === 'Lolos Pemeriksaan' && prevInsp?.status !== 'Lolos Pemeriksaan') {
      db.prepare(`UPDATE raw_material_transactions SET status = 'Diterima', shipping_status = 'Diterima Gudang' WHERE id = ?`).run(txId);
      db.prepare(`UPDATE raw_materials SET stock_available = MAX(0, stock_available - ?) WHERE id = ?`).run(actualQty, tx.raw_material_id);
      const inv = db.prepare(`SELECT id FROM inventory WHERE item_type = 'raw_material' AND ref_id = ?`).get(tx.raw_material_id) as
        | { id: number }
        | undefined;
      if (inv) {
        db.prepare(`UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?`).run(actualQty, inv.id);
      } else {
        db.prepare(`INSERT INTO inventory (item_type, ref_id, item_name, unit, quantity, min_threshold) VALUES ('raw_material', ?, ?, ?, ?, 50)`).run(
          tx.raw_material_id,
          tx.material_name,
          tx.unit,
          actualQty
        );
      }
    }

    res.json({ ok: true });
  });

  // Supply Chat
  app.get('/api/supply/chats/:supplierId', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const sid = Number(req.params.supplierId);
    const messages = db.prepare(`SELECT * FROM supply_chat_messages WHERE supplier_id = ? ORDER BY id ASC`).all(sid);
    res.json({ messages });
  });

  app.post('/api/supply/chats/:supplierId', requireRoles(...SUPPLIER_ROLES), (req, res) => {
    const sid = Number(req.params.supplierId);
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
      return;
    }
    const profile = db.prepare(`SELECT full_name FROM user_profiles WHERE user_id = ?`).get(req.user!.userId) as { full_name: string } | undefined;
    db.prepare(
      `INSERT INTO supply_chat_messages (supplier_id, sender_user_id, sender_role, sender_name, message) VALUES (?, ?, ?, ?, ?)`
    ).run(sid, req.user!.userId, req.user!.role, profile?.full_name || req.user!.email, String(message).trim());
    res.status(201).json({ ok: true });
  });

  // Supplier Evaluation
  app.post('/api/supply/evaluations', requireRoles('admin'), (req, res) => {
    const { supplierId, timelinessScore, qualityScore, communicationScore, notes } = req.body || {};
    const t = Math.min(5, Math.max(1, Number(timelinessScore || 5)));
    const q = Math.min(5, Math.max(1, Number(qualityScore || 5)));
    const c = Math.min(5, Math.max(1, Number(communicationScore || 5)));
    const overall = Number(((t + q + c) / 3).toFixed(1));

    db.prepare(
      `INSERT INTO supplier_evaluations (supplier_id, evaluated_by, timeliness_score, quality_score, communication_score, overall_score, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(Number(supplierId), req.user!.email, t, q, c, overall, String(notes || ''));

    const avgRow = db.prepare(`SELECT ROUND(AVG(overall_score), 1) as avg_rating FROM supplier_evaluations WHERE supplier_id = ?`).get(Number(supplierId)) as { avg_rating: number };
    if (avgRow?.avg_rating) {
      db.prepare(`UPDATE suppliers SET rating = ? WHERE id = ?`).run(avgRow.avg_rating, Number(supplierId));
    }

    res.status(201).json({ ok: true, overall });
  });

  // ==========================================
  // 5. MORI-PRODUCTION (Admin Only)
  // ==========================================
  app.get('/api/production', requireRoles('admin'), (_req, res) => {
    const batches = db
      .prepare(
        `SELECT pb.*, qt.status as qc_status, pt.qr_data_url, pt.qr_payload
         FROM production_batches pb
         LEFT JOIN quality_tests qt ON qt.batch_id = pb.id
         LEFT JOIN product_traceability pt ON pt.batch_id = pb.id
         ORDER BY pb.id DESC`
      )
      .all();
    const compStmt = db.prepare(
      `SELECT bc.*, s.company_name as supplier_name FROM batch_compositions bc LEFT JOIN suppliers s ON bc.supplier_id = s.id WHERE bc.batch_id = ?`
    );
    const enriched = batches.map((b: any) => ({ ...b, compositions: compStmt.all(b.id) }));
    const inventory = db.prepare(`SELECT * FROM inventory ORDER BY item_type ASC, id ASC`).all();
    const materials = db
      .prepare(`SELECT rm.*, s.company_name FROM raw_materials rm JOIN suppliers s ON rm.supplier_id = s.id`)
      .all();

    res.json({ batches: enriched, inventory, materials });
  });

  app.post('/api/production/batches', requireRoles('admin'), async (req, res) => {
    const { quantityKg, productionDate, packagingDate, formulationNote, compositions } = req.body || {};
    const qtyKg = Math.max(10, Number(quantityKg || 100));
    const pouches = Math.floor(qtyKg); // 1 kg per standing pouch
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM production_batches`).get() as { cnt: number };
    const nextNum = String(countRow.cnt + 1).padStart(3, '0');
    const year = new Date().getFullYear();
    const batchCode = `BATCH-MF-${year}-${nextNum}`;

    const product = db.prepare(`SELECT id FROM products LIMIT 1`).get() as { id: number };
    const prodDate = productionDate || new Date().toISOString().slice(0, 10);
    const packDate = packagingDate || prodDate;
    const note = formulationNote || 'Formulasi produksi awal (dapat diedit admin — belum final tervalidasi).';

    const batchId = Number(
      db
        .prepare(
          `INSERT INTO production_batches (batch_code, product_id, quantity_kg, pouches_produced, production_date, packaging_date, formulation_note, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(batchCode, product.id, qtyKg, pouches, prodDate, packDate, note, req.user!.userId).lastInsertRowid
    );

    const compList = Array.isArray(compositions) && compositions.length > 0
      ? compositions
      : [
          { materialName: 'Frass Black Soldier Fly (BSF)', percentage: 50, origin: 'Bojonegoro, Jatim' },
          { materialName: 'Kompos Matang Terfermentasi', percentage: 30, origin: 'Sidoarjo, Jatim' },
          { materialName: 'Biochar Sekam Padi', percentage: 12, origin: 'Ngawi, Jatim' },
          { materialName: 'Serbuk Daun Kelor (Moringa oleifera)', percentage: 8, origin: 'Sumenep, Madura' },
        ];

    const insertComp = db.prepare(
      `INSERT INTO batch_compositions (batch_id, raw_material_id, supplier_id, material_name, percentage, quantity_kg, origin) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of compList) {
      const pct = Number(c.percentage || 0);
      const kg = Number(((qtyKg * pct) / 100).toFixed(2));
      insertComp.run(batchId, c.rawMaterialId || null, c.supplierId || null, String(c.materialName), pct, kg, String(c.origin || 'Indonesia'));
      if (c.rawMaterialId) {
        db.prepare(`UPDATE inventory SET quantity = MAX(0, quantity - ?), updated_at = datetime('now') WHERE item_type = 'raw_material' AND ref_id = ?`).run(
          kg,
          Number(c.rawMaterialId)
        );
      }
    }

    // Add finished pouches to inventory
    db.prepare(`UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE item_type = 'finished_good' AND ref_id = ?`).run(
      pouches,
      product.id
    );

    // Create initial QC record waiting for admin test
    db.prepare(`INSERT INTO quality_tests (batch_id, status) VALUES (?, 'Menunggu pengujian')`).run(batchId);

    // Generate real QR code
    const qrPayload = `MORIFRASS:${batchCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      color: { dark: '#144A17', light: '#FFFFFF' },
    });

    db.prepare(
      `INSERT INTO product_traceability (batch_id, qr_payload, qr_data_url, distribution_region, distributor_name, verification_status)
       VALUES (?, ?, ?, 'Gudang Pusat MORIFRASS', 'Menunggu Distribusi', 'Tercatat di Simulasi Ledger')`
    ).run(batchId, qrPayload, qrDataUrl);

    const hash = createLedgerHash(`${batchCode}:CREATED:${Date.now()}`);
    db.prepare(
      `INSERT INTO blockchain_ledger_records (batch_id, tx_id, block_number, previous_hash, record_hash, action_type, actor_role, payload_summary, is_simulation)
       VALUES (?, ?, ?, ?, ?, 'BATCH_CREATED', 'Admin/Produsen', ?, 1)`
    ).run(batchId, hash.slice(0, 22), 1100 + batchId, '0x' + '0'.repeat(64), hash, `Batch ${batchCode} (${pouches} kemasan 1 kg) dibuat & QR dicetak`);

    res.status(201).json({ id: batchId, batchCode, qrDataUrl });
  });

  app.patch('/api/production/inventory/:id', requireRoles('admin'), (req, res) => {
    const invId = Number(req.params.id);
    const { quantity } = req.body || {};
    db.prepare(`UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(Math.max(0, Number(quantity || 0)), invId);
    res.json({ ok: true });
  });

  // ==========================================
  // 6. MORI-QUALITY (Admin Only)
  // ==========================================
  app.get('/api/quality', requireRoles('admin'), (_req, res) => {
    const tests = db
      .prepare(
        `SELECT qt.*, pb.batch_code, pb.production_date, pb.pouches_produced
         FROM quality_tests qt
         JOIN production_batches pb ON qt.batch_id = pb.id
         ORDER BY pb.id DESC`
      )
      .all();
    res.json({ tests });
  });

  app.put('/api/quality/:batchId', requireRoles('admin'), (req, res) => {
    const batchId = Number(req.params.batchId);
    const { moisturePct, phLevel, npkSummary, cOrganicPct, cnRatio, labResultSummary, testDate, documentRef, status } = req.body || {};
    const validStatuses = ['Menunggu pengujian', 'Dalam pemeriksaan', 'Lulus pemeriksaan', 'Memerlukan evaluasi'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Status QC tidak valid.' });
      return;
    }

    const batch = db.prepare(`SELECT batch_code FROM production_batches WHERE id = ?`).get(batchId) as { batch_code: string } | undefined;
    if (!batch) {
      res.status(404).json({ error: 'Batch produksi tidak ditemukan.' });
      return;
    }

    db.prepare(
      `UPDATE quality_tests SET
        moisture_pct = ?,
        ph_level = ?,
        npk_summary = ?,
        c_organic_pct = ?,
        cn_ratio = ?,
        lab_result_summary = ?,
        test_date = ?,
        document_ref = ?,
        status = ?,
        tested_by = ?,
        updated_at = datetime('now')
       WHERE batch_id = ?`
    ).run(
      moisturePct !== undefined && moisturePct !== '' ? Number(moisturePct) : null,
      phLevel !== undefined && phLevel !== '' ? Number(phLevel) : null,
      String(npkSummary || ''),
      cOrganicPct !== undefined && cOrganicPct !== '' ? Number(cOrganicPct) : null,
      cnRatio !== undefined && cnRatio !== '' ? Number(cnRatio) : null,
      String(labResultSummary || ''),
      String(testDate || new Date().toISOString().slice(0, 10)),
      String(documentRef || ''),
      status,
      req.user!.email,
      batchId
    );

    // Append QC event to simulated blockchain ledger
    const lastBlock = db
      .prepare(`SELECT block_number, record_hash FROM blockchain_ledger_records WHERE batch_id = ? ORDER BY block_number DESC LIMIT 1`)
      .get(batchId) as { block_number: number; record_hash: string } | undefined;
    const prevHash = lastBlock?.record_hash || '0x' + '0'.repeat(64);
    const nextBlock = (lastBlock?.block_number || 1000) + 1;
    const summary = `QC Update: ${status} (pH ${phLevel || '-'}, Kadar Air ${moisturePct || '-'}%)`;
    const newHash = createLedgerHash(`${prevHash}:${summary}:${Date.now()}`);

    db.prepare(
      `INSERT INTO blockchain_ledger_records (batch_id, tx_id, block_number, previous_hash, record_hash, action_type, actor_role, payload_summary, is_simulation)
       VALUES (?, ?, ?, ?, ?, 'QC_UPDATED', 'Quality Control', ?, 1)`
    ).run(batchId, newHash.slice(0, 22), nextBlock, prevHash, newHash, summary);

    res.json({ ok: true });
  });

  // ==========================================
  // 7. MORI-EDU (Learn, Quiz, Missions, Points, Levels, Badges, Rewards, Leaderboard)
  // ==========================================
  app.get('/api/edu', (req, res) => {
    const materials = db.prepare(`SELECT * FROM learning_materials ORDER BY sort_order ASC`).all().map((m: any) => ({
      ...m,
      content_points: JSON.parse(m.content_points),
    }));
    const questions = db.prepare(`SELECT id, material_id, question_type, question, image_hint, options_json FROM quiz_questions`).all().map((q: any) => ({
      ...q,
      options: JSON.parse(q.options_json),
    }));
    const levels = db.prepare(`SELECT * FROM user_levels ORDER BY level_number ASC`).all();
    const rewards = db.prepare(`SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_cost ASC`).all();
    const missions = db.prepare(`SELECT * FROM missions ORDER BY id ASC`).all();

    let userEdu: any = null;
    if (req.user) {
      const uid = req.user.userId;
      const profile = db
        .prepare(
          `SELECT up.*, ul.level_number, ul.name as level_name, ul.min_points
           FROM user_profiles up LEFT JOIN user_levels ul ON up.level_id = ul.id WHERE up.user_id = ?`
        )
        .get(uid);
      const progress = db.prepare(`SELECT * FROM learning_progress WHERE user_id = ?`).all(uid);
      const userMissions = db.prepare(`SELECT * FROM user_missions WHERE user_id = ?`).all(uid);
      const pointTransactions = db.prepare(`SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`).all(uid);
      const badges = db.prepare(`SELECT * FROM user_badges WHERE user_id = ?`).all(uid);
      const vouchers = db
        .prepare(`SELECT vc.*, r.title as reward_title FROM voucher_codes vc JOIN rewards r ON vc.reward_id = r.id WHERE vc.user_id = ? ORDER BY vc.created_at DESC`)
        .all(uid);
      userEdu = { profile, progress, userMissions, pointTransactions, badges, vouchers };
    }

    res.json({ materials, questions, levels, rewards, missions, userEdu });
  });

  app.post('/api/edu/learn/:materialId/complete', requireAuth, (req, res) => {
    const matId = Number(req.params.materialId);
    const { type } = req.body || {}; // 'article' | 'video'
    const mat = db.prepare(`SELECT * FROM learning_materials WHERE id = ?`).get(matId) as
      | { id: number; title: string; points_reward: number }
      | undefined;
    if (!mat) {
      res.status(404).json({ error: 'Materi tidak ditemukan.' });
      return;
    }

    const uid = req.user!.userId;
    const existing = db.prepare(`SELECT * FROM learning_progress WHERE user_id = ? AND material_id = ?`).get(uid, matId) as
      | { id: number; article_completed: number; video_watched: number }
      | undefined;

    let awarded = 0;
    if (!existing) {
      const isArt = type === 'video' ? 0 : 1;
      const isVid = type === 'video' ? 1 : 0;
      db.prepare(
        `INSERT INTO learning_progress (user_id, material_id, article_completed, video_watched, completed_at) VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(uid, matId, isArt, isVid);
      awarded = isVid ? 15 : mat.points_reward;
    } else {
      if (type === 'video' && !existing.video_watched) {
        db.prepare(`UPDATE learning_progress SET video_watched = 1 WHERE id = ?`).run(existing.id);
        awarded = 15;
      } else if (type !== 'video' && !existing.article_completed) {
        db.prepare(`UPDATE learning_progress SET article_completed = 1, completed_at = datetime('now') WHERE id = ?`).run(existing.id);
        awarded = mat.points_reward;
      }
    }

    if (awarded > 0) {
      awardPoints(uid, awarded, 'MORI-LEARN', `${type === 'video' ? 'Menonton video' : 'Membaca materi'}: ${mat.title}`);
      bumpMission(uid, type === 'video' ? 'watch_video' : 'read_article', 1);
      bumpMission(uid, 'complete_3_articles', 1);
      unlockBadge(uid, 'ECO_LEARNER', 'Eco Learner', 'Menyelesaikan materi edukasi di MORI-LEARN');

      const completedCount = (
        db.prepare(`SELECT COUNT(*) as cnt FROM learning_progress WHERE user_id = ? AND article_completed = 1`).get(uid) as { cnt: number }
      ).cnt;
      if (completedCount >= 3) {
        unlockBadge(uid, 'ORGANIC_EXPERT', 'Organic Fertilizer Expert', 'Menyelesaikan 3+ modul pupuk organik');
      }
      if (completedCount >= 6) {
        unlockBadge(uid, 'GREEN_HERO', 'Green Agriculture Hero', 'Menyelesaikan 6+ modul pertanian berkelanjutan');
      }
    }

    res.json({ ok: true, pointsAwarded: awarded });
  });

  app.post('/api/edu/quiz/submit', requireAuth, (req, res) => {
    const { answers } = req.body || {}; // Record<questionId, selectedOption>
    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ error: 'Jawaban kuis tidak valid.' });
      return;
    }
    const questions = db.prepare(`SELECT * FROM quiz_questions`).all() as Array<{
      id: number;
      question: string;
      correct_answer: string;
      explanation: string;
    }>;

    let correctCount = 0;
    const results = questions.map((q) => {
      const userAns = String(answers[q.id] || '');
      const isCorrect = userAns === q.correct_answer;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        question: q.question,
        userAnswer: userAns,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const scorePct = Math.round((correctCount / Math.max(1, questions.length)) * 100);
    const passed = scorePct >= 80;
    const pointsAwarded = passed ? 30 : 0;

    db.prepare(
      `INSERT INTO quiz_attempts (user_id, category, score_pct, correct_count, total_count, points_awarded) VALUES (?, 'Umum', ?, ?, ?, ?)`
    ).run(req.user!.userId, scorePct, correctCount, questions.length, pointsAwarded);

    if (passed) {
      awardPoints(req.user!.userId, pointsAwarded, 'MORI-QUIZ', `Lulus MORI-QUIZ dengan skor ${scorePct}%`);
      bumpMission(req.user!.userId, 'pass_quiz', 1);
      bumpMission(req.user!.userId, 'weekly_explorer', 1);
      unlockBadge(req.user!.userId, 'BSF_MASTER', 'BSF Knowledge Master', 'Lulus kuis MORI-EDU dengan skor minimal 80%');
    }

    res.json({ scorePct, correctCount, totalCount: questions.length, passed, pointsAwarded, results });
  });

  app.post('/api/edu/missions/:missionId/claim', requireAuth, (req, res) => {
    const missionId = Number(req.params.missionId);
    const um = db
      .prepare(
        `SELECT um.*, m.points_reward, m.title FROM user_missions um JOIN missions m ON um.mission_id = m.id
         WHERE um.user_id = ? AND um.mission_id = ?`
      )
      .get(req.user!.userId, missionId) as
      | { id: number; completed: number; claimed: number; points_reward: number; title: string }
      | undefined;

    if (!um || !um.completed) {
      res.status(400).json({ error: 'Misi belum diselesaikan.' });
      return;
    }
    if (um.claimed) {
      res.status(400).json({ error: 'Hadiah misi sudah diklaim.' });
      return;
    }

    db.prepare(`UPDATE user_missions SET claimed = 1, updated_at = datetime('now') WHERE id = ?`).run(um.id);
    awardPoints(req.user!.userId, um.points_reward, 'MORI-MISSION', `Klaim misi: ${um.title}`);
    res.json({ ok: true, pointsAwarded: um.points_reward });
  });

  app.post('/api/edu/rewards/:rewardId/redeem', requireAuth, (req, res) => {
    const rewardId = Number(req.params.rewardId);
    const reward = db.prepare(`SELECT * FROM rewards WHERE id = ? AND is_active = 1`).get(rewardId) as
      | {
          id: number;
          code: string;
          title: string;
          reward_type: string;
          points_cost: number;
          discount_amount: number;
          max_subsidy: number;
          min_purchase: number;
          remaining_quota: number;
          valid_days: number;
        }
      | undefined;

    if (!reward) {
      res.status(404).json({ error: 'Reward tidak ditemukan.' });
      return;
    }
    if (reward.remaining_quota <= 0) {
      res.status(400).json({ error: 'Kuota reward sudah habis.' });
      return;
    }

    const profile = db.prepare(`SELECT points_available FROM user_profiles WHERE user_id = ?`).get(req.user!.userId) as {
      points_available: number;
    };
    if (!profile || profile.points_available < reward.points_cost) {
      res.status(400).json({ error: `Poin Anda belum cukup (butuh ${reward.points_cost} poin).` });
      return;
    }

    const voucherCode = `MORI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + reward.valid_days * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `UPDATE user_profiles SET points_available = points_available - ?, points_redeemed = points_redeemed + ? WHERE user_id = ?`
    ).run(reward.points_cost, reward.points_cost, req.user!.userId);

    db.prepare(`UPDATE rewards SET remaining_quota = remaining_quota - 1 WHERE id = ?`).run(reward.id);

    const voucherId = Number(
      db
        .prepare(
          `INSERT INTO voucher_codes (code, reward_id, user_id, reward_type, discount_amount, max_subsidy, min_purchase, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          voucherCode,
          reward.id,
          req.user!.userId,
          reward.reward_type,
          reward.discount_amount,
          reward.max_subsidy,
          reward.min_purchase,
          expiresAt
        ).lastInsertRowid
    );

    db.prepare(`INSERT INTO voucher_redemptions (voucher_id, user_id, reward_id, points_spent) VALUES (?, ?, ?, ?)`).run(
      voucherId,
      req.user!.userId,
      reward.id,
      reward.points_cost
    );

    db.prepare(`INSERT INTO point_transactions (user_id, amount, tx_type, source, description) VALUES (?, ?, 'redeem', 'MORI-REWARDS', ?)`).run(
      req.user!.userId,
      -reward.points_cost,
      `Tukar ${reward.title} (${voucherCode})`
    );

    addNotification(
      req.user!.userId,
      'Voucher Berhasil Ditukar',
      `Kode ${voucherCode} (${reward.title}) kini tersedia di akun MORI-MARKET Anda.`,
      'reward'
    );

    res.status(201).json({ voucherCode, title: reward.title, expiresAt });
  });

  app.put('/api/admin/rewards/:id', requireRoles('admin'), (req, res) => {
    const rewardId = Number(req.params.id);
    const { title, pointsCost, discountAmount, maxSubsidy, minPurchase, quota, validDays } = req.body || {};
    db.prepare(
      `UPDATE rewards SET
        title = COALESCE(?, title),
        points_cost = COALESCE(?, points_cost),
        discount_amount = COALESCE(?, discount_amount),
        max_subsidy = COALESCE(?, max_subsidy),
        min_purchase = COALESCE(?, min_purchase),
        quota = COALESCE(?, quota),
        remaining_quota = COALESCE(?, remaining_quota),
        valid_days = COALESCE(?, valid_days)
       WHERE id = ?`
    ).run(
      title ?? null,
      pointsCost !== undefined ? Number(pointsCost) : null,
      discountAmount !== undefined ? Number(discountAmount) : null,
      maxSubsidy !== undefined ? Number(maxSubsidy) : null,
      minPurchase !== undefined ? Number(minPurchase) : null,
      quota !== undefined ? Number(quota) : null,
      quota !== undefined ? Number(quota) : null,
      validDays !== undefined ? Number(validDays) : null,
      rewardId
    );
    res.json({ ok: true });
  });

  app.get('/api/edu/leaderboard', (req, res) => {
    const period = String(req.query.period || 'weekly'); // daily | weekly | monthly
    const rows = db
      .prepare(
        `SELECT up.user_id, up.full_name, up.avatar_url, up.leaderboard_anonymous, up.points_total, up.is_simulation,
                ul.name as level_name, ul.level_number,
                (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = up.user_id) as badge_count
         FROM user_profiles up
         LEFT JOIN user_levels ul ON up.level_id = ul.id
         ORDER BY up.points_total DESC
         LIMIT 15`
      )
      .all() as Array<any>;

    const factor = period === 'daily' ? 0.15 : period === 'weekly' ? 0.45 : 1;
    const leaderboard = rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.user_id,
      displayName: r.leaderboard_anonymous ? `Petani Sirkular #${r.user_id}` : r.full_name,
      avatarUrl: r.avatar_url,
      points: Math.max(10, Math.round(r.points_total * factor)),
      totalPoints: r.points_total,
      levelName: r.level_name || 'Seed Beginner',
      badgeCount: r.badge_count,
      isSimulation: !!r.is_simulation,
    }));

    res.json({ period, leaderboard });
  });

  // ==========================================
  // 8. ADMIN OVERVIEW DASHBOARD
  // ==========================================
  app.get('/api/admin/overview', requireRoles('admin'), (_req, res) => {
    const sales = db
      .prepare(`SELECT COUNT(*) as total_orders, COALESCE(SUM(grand_total), 0) as total_revenue, COALESCE(SUM(total_items), 0) as total_units FROM orders`)
      .get() as { total_orders: number; total_revenue: number; total_units: number };
    const customers = (db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'`).get() as { cnt: number }).cnt;
    const suppliers = (db.prepare(`SELECT COUNT(*) as cnt FROM suppliers`).get() as { cnt: number }).cnt;
    const batches = (db.prepare(`SELECT COUNT(*) as cnt FROM production_batches`).get() as { cnt: number }).cnt;
    const rawStock = (db.prepare(`SELECT COALESCE(SUM(quantity), 0) as qty FROM inventory WHERE item_type = 'raw_material'`).get() as { qty: number }).qty;
    const finishedStock = (db.prepare(`SELECT COALESCE(SUM(quantity), 0) as qty FROM inventory WHERE item_type = 'finished_good'`).get() as { qty: number }).qty;
    const qrScans = (db.prepare(`SELECT COALESCE(SUM(scan_count), 0) as scans FROM product_traceability`).get() as { scans: number }).scans;
    const pointsDistributed = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as pts FROM point_transactions WHERE tx_type = 'earn'`).get() as { pts: number }).pts;
    const vouchersRedeemed = (db.prepare(`SELECT COUNT(*) as cnt FROM voucher_redemptions`).get() as { cnt: number }).cnt;
    const eduCompletions = (db.prepare(`SELECT COUNT(*) as cnt FROM learning_progress WHERE article_completed = 1`).get() as { cnt: number }).cnt;

    const qcBreakdown = db.prepare(`SELECT status, COUNT(*) as count FROM quality_tests GROUP BY status`).all();

    const monthlySalesSeries = [
      { month: 'Jul', revenue: 1250000, units: 36, isSimulation: true },
      { month: 'Agu', revenue: 1890000, units: 54, isSimulation: true },
      { month: 'Sep', revenue: 2420000, units: 71, isSimulation: true },
      { month: 'Okt', revenue: 3150000, units: 92, isSimulation: true },
      { month: 'Nov', revenue: Math.max(sales.total_revenue, 3410000), units: Math.max(sales.total_units, 98), isSimulation: true },
    ];

    const activitySeries = [
      { label: 'Scan QR', value: qrScans },
      { label: 'Materi Selesai', value: eduCompletions },
      { label: 'Kuis', value: (db.prepare(`SELECT COUNT(*) as cnt FROM quiz_attempts`).get() as { cnt: number }).cnt },
      { label: 'Voucher', value: vouchersRedeemed },
    ];

    res.json({
      kpis: {
        ...sales,
        customers,
        suppliers,
        batches,
        rawStock,
        finishedStock,
        qrScans,
        pointsDistributed,
        vouchersRedeemed,
        eduCompletions,
      },
      qcBreakdown,
      monthlySalesSeries,
      activitySeries,
    });
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MORIFRASS Ecosystem Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MORIFRASS server:', err);
  process.exit(1);
});
