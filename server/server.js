// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Pool } from "pg";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONT_ORIGIN = process.env.APP_URL || true;

// ===== DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===== bootstrap schema (создаём exchanges, если нет)
async function ensureSchema() {
  // таблица exchanges для заявок на обмен
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exchanges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      base_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      target_object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      nights INTEGER NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ
    );
  `);
  // индексы на поиск
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exchanges_user ON exchanges(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);`);
}
ensureSchema().catch((e) => console.error("ensureSchema error:", e));

// ===== Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const cloudOK = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
console.log("Cloudinary configured:", cloudOK);

// ===== Multer (приём файлов в память)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// ===== middlewares
app.use(cors({ origin: FRONT_ORIGIN, credentials: true }));
app.use(express.json());

// ===== ping
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is up 🚀" });
});

// ===================== USERS =====================
app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, status, phone
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error("DB error in /api/users:", e);
    res.status(500).json({ error: "DB error" });
  }
});

const ALLOWED = new Set(["lead", "owner", "client"]);

app.put("/api/users/:id/status", async (req, res) => {
  const { id } = req.params;
  let { status } = req.body || {};
  status = String(status || "").toLowerCase();

  if (!ALLOWED.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users
         SET status = $1
       WHERE id = $2
       RETURNING id, full_name, phone, status`,
      [status, id]
    );

    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("DB error in PUT /api/users/:id/status:", e);
    res.status(500).json({ error: "DB error" });
  }
});

// ===================== OBJECTS =====================
app.get("/api/objects", async (req, res) => {
  try {
    const { owner_id } = req.query;
    const q = owner_id
      ? { text: `SELECT * FROM objects WHERE owner_id = $1 ORDER BY created_at DESC`, values: [Number(owner_id)] }
      : { text: `SELECT * FROM objects ORDER BY created_at DESC`, values: [] };

    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/objects:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:id/objects", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM objects WHERE owner_id = $1 ORDER BY created_at DESC`,
      [Number(id)]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/users/:id/objects:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// СОЗДАТЬ объект
app.post("/api/objects", upload.array("images", 6), async (req, res) => {
  try {
    const {
      title, description, owner_id, owner_name, owner_contact,
      address, area, rooms, share
    } = req.body;

    if (!title) return res.status(400).json({ error: "Title is required" });

    const urls = [];
    if (Array.isArray(req.files) && req.files.length && cloudOK) {
      for (const file of req.files) {
        const uploaded = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "hotel_objects" },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          stream.end(file.buffer);
        });
        urls.push(uploaded.secure_url);
      }
    } else if (Array.isArray(req.files) && req.files.length && !cloudOK) {
      console.warn("Images were sent but Cloudinary isn't configured — skipping upload.");
    }

    const areaNum  = area !== undefined && area !== null && String(area).trim() !== "" ? Number(area) : null;
    const roomsInt = rooms !== undefined && rooms !== null && String(rooms).trim() !== "" ? parseInt(rooms, 10) : null;

    const { rows } = await pool.query(
      `INSERT INTO objects (
         owner_id, title, description, images,
         owner_name, owner_contact,
         address, area, rooms, share
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, owner_id, title, description, images,
                 owner_name, owner_contact,
                 address, area, rooms, share, created_at`,
      [
        owner_id ? Number(owner_id) : null,
        title.trim(),
        description?.trim() || null,
        urls,
        owner_name?.trim() || null,
        owner_contact?.trim() || null,
        address?.trim() || null,
        Number.isFinite(areaNum) ? areaNum : null,
        Number.isInteger(roomsInt) ? roomsInt : null,
        share?.trim() || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /api/objects:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ===================== HEALTH & AUTH =====================
app.get("/healthz", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: r.rows[0].now });
  } catch (err) {
    console.error("healthz error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const q = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1,$2,$3,$4,'user')
       RETURNING id, email, role, full_name, phone, created_at`,
      [String(email).toLowerCase().trim(), String(password), fullName || null, phone || null]
    );

    res.json({ ok: true, user: q.rows[0] });
  } catch (err) {
    console.error("register error:", err);
    if (err.code === "23505") return res.status(409).json({ error: "email already exists" });
    res.status(500).json({ error: "server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const q = await pool.query(
      `SELECT id, email, password_hash, full_name, phone, role, created_at
       FROM users WHERE email = $1`,
      [String(email).toLowerCase().trim()]
    );

    if (q.rowCount === 0) return res.status(401).json({ error: "invalid_credentials" });

    const user = q.rows[0];
    if (String(user.password_hash) !== String(password)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    delete user.password_hash;
    res.json({ ok: true, user });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ===================== BOOKINGS =====================
// создать бронь
app.post("/api/bookings", async (req, res) => {
  try {
    const { objectId, startDate, endDate, guests = 1, note = null, userId } = req.body;

    if (!objectId || !startDate || !endDate || !userId) {
      return res.status(400).json({ error: "objectId, userId, startDate, endDate обязательны" });
    }

    // проверяем пересечения (pending/confirmed блокируют)
    const conflict = await pool.query(
      `SELECT 1 FROM bookings 
       WHERE object_id = $1 AND status IN ('pending','confirmed')
         AND NOT ($4 < start_date OR $3 > end_date)
       LIMIT 1`,
      [objectId, userId, startDate, endDate]
    );
    if (conflict.rowCount > 0) {
      return res.status(409).json({ error: "Эти даты уже заняты" });
    }

    const query = `
      INSERT INTO bookings (object_id, user_id, status, start_date, end_date, guests, note)
      VALUES ($1, $2, 'pending', $3, $4, $5, $6)
      RETURNING *;`;
    const values = [objectId, userId, startDate, endDate, guests, note];

    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// получить все бронирования
app.get("/api/bookings", async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT b.id, b.start_date, b.end_date, b.status,
              b.object_id, b.user_id,
              u.full_name AS user_name, u.phone AS user_phone,
              o.title AS object_title
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN objects o ON b.object_id = o.id
       ORDER BY b.created_at DESC;`
    );
    res.json(q.rows);
  } catch (err) {
    console.error("Error loading bookings:", err);
    res.status(500).json({ error: "server error" });
  }
});

// удалить бронь
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const q = await pool.query(`DELETE FROM bookings WHERE id = $1 RETURNING id`, [req.params.id]);
    if (q.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, id: q.rows[0].id });
  } catch (err) {
    console.error("DELETE /api/bookings/:id:", err);
    res.status(500).json({ error: "server error" });
  }
});

// изменить статус брони
app.patch("/api/bookings/:id", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "confirmed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    const q = await pool.query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json(q.rows[0]);
  } catch (err) {
    console.error("Error updating booking:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ===================== EXCHANGES (обмен неделями) =====================

// список обменов (для админки/истории). Можно фильтровать по user_id
app.get("/api/exchanges", async (req, res) => {
  try {
    const { user_id } = req.query;
    const args = [];
    let where = "";
    if (user_id) {
      args.push(Number(user_id));
      where = `WHERE e.user_id = $1`;
    }
    const q = await pool.query(
      `
      SELECT e.*,
             bo.object_id AS base_object_id,
             obase.title  AS base_object_title,
             otarget.title AS target_object_title
      FROM exchanges e
      LEFT JOIN bookings bo ON bo.id = e.base_booking_id
      LEFT JOIN objects obase ON obase.id = bo.object_id
      LEFT JOIN objects otarget ON otarget.id = e.target_object_id
      ${where}
      ORDER BY e.created_at DESC
      `,
      args
    );
    res.json(q.rows);
  } catch (e) {
    console.error("GET /api/exchanges", e);
    res.status(500).json({ error: "server error" });
  }
});

// создать запрос на обмен
app.post("/api/exchanges", async (req, res) => {
  try {
    const { userId, baseBookingId, targetObjectId, startDate, endDate, message = null } = req.body || {};
    if (!userId || !baseBookingId || !targetObjectId || !startDate || !endDate) {
      return res.status(400).json({ error: "userId, baseBookingId, targetObjectId, startDate, endDate обязательны" });
    }

    // 1) исходная бронь
    const baseQ = await pool.query(
      `SELECT b.*, o.title AS base_object_title
       FROM bookings b
       LEFT JOIN objects o ON o.id = b.object_id
       WHERE b.id = $1`,
      [Number(baseBookingId)]
    );
    if (baseQ.rowCount === 0) return res.status(404).json({ error: "base booking not found" });
    const base = baseQ.rows[0];
    if (Number(base.user_id) !== Number(userId))
      return res.status(403).json({ error: "not owner of booking" });
    if (base.status !== "confirmed")
      return res.status(400).json({ error: "исходная бронь должна быть подтверждена" });

    // 2) длина должна совпасть
    const baseNights = Math.max(1, Math.round((new Date(base.end_date) - new Date(base.start_date)) / 86400000));
    const selNights = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
    if (baseNights !== selNights) {
      return res.status(400).json({ error: `нужно выбрать ровно ${baseNights} ночей` });
    }

    // 3) нельзя тот же самый дом
    if (Number(base.object_id) === Number(targetObjectId)) {
      return res.status(400).json({ error: "нужно выбрать другой дом" });
    }

    // 4) проверяем доступность целевого объекта
    const conflict = await pool.query(
      `SELECT 1 FROM bookings 
       WHERE object_id = $1 AND status IN ('pending','confirmed')
         AND NOT ($3 < start_date OR $2 > end_date)
       LIMIT 1`,
      [Number(targetObjectId), startDate, endDate]
    );
    if (conflict.rowCount > 0) {
      return res.status(409).json({ error: "на выбранные даты дом занят" });
    }

    // 5) создаём заявку
    const ins = await pool.query(
      `INSERT INTO exchanges
         (user_id, base_booking_id, target_object_id, start_date, end_date, nights, message, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
       RETURNING *`,
      [Number(userId), Number(baseBookingId), Number(targetObjectId), startDate, endDate, baseNights, message]
    );

    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("POST /api/exchanges", e);
    res.status(500).json({ error: "server error" });
  }
});

// изменить статус обмена (approve / reject)
// approve: переносим базовую бронь на новый объект и новые даты (в транзакции)
app.patch("/api/exchanges/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { action } = req.body || {}; // "approve" | "reject"
    const id = Number(req.params.id);
    if (!id || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "invalid input" });
    }

    await client.query("BEGIN");

    const q = await client.query(`SELECT * FROM exchanges WHERE id = $1 FOR UPDATE`, [id]);
    if (q.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    const ex = q.rows[0];
    if (ex.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "already decided" });
    }

    if (action === "reject") {
      const upd = await client.query(
        `UPDATE exchanges SET status='rejected', decided_at=NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query("COMMIT");
      return res.json(upd.rows[0]);
    }

    // approve
    // блокируем исходную бронь
    const baseQ = await client.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [ex.base_booking_id]);
    if (baseQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "base booking not found" });
    }
    const base = baseQ.rows[0];

    // проверяем, что даты свободны по целевому объекту на момент подтверждения
    const conflict = await client.query(
      `SELECT 1 FROM bookings 
       WHERE object_id = $1 
         AND id <> $2
         AND status IN ('pending','confirmed')
         AND NOT ($4 < start_date OR $3 > end_date)
       LIMIT 1`,
      [ex.target_object_id, base.id, ex.start_date, ex.end_date]
    );
    if (conflict.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "даты уже заняты, подтвердить невозможно" });
    }

    // переносим бронь
    const updBooking = await client.query(
      `UPDATE bookings
         SET object_id = $1,
             start_date = $2,
             end_date = $3,
             status = 'confirmed'
       WHERE id = $4
       RETURNING *`,
      [ex.target_object_id, ex.start_date, ex.end_date, base.id]
    );

    // закрываем запрос обмена
    const updEx = await client.query(
      `UPDATE exchanges
         SET status='approved', decided_at=NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    res.json({ exchange: updEx.rows[0], booking: updBooking.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PATCH /api/exchanges/:id", e);
    res.status(500).json({ error: "server error" });
  } finally {
    client.release();
  }
});

// ===================== USERS PATCH (профиль) =====================
app.patch("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  let { full_name, email, phone } = req.body || {};
  if (typeof full_name === "string") full_name = full_name.trim();
  if (typeof email === "string") email = email.trim().toLowerCase();
  if (typeof phone === "string") phone = phone.trim();

  try {
    const q = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         email     = COALESCE($2, email),
         phone     = COALESCE($3, phone)
       WHERE id = $4
       RETURNING id, email, full_name, phone, role, created_at`,
      [full_name ?? null, email ?? null, phone ?? null, Number(id)]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(q.rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "email already exists" });
    }
    console.error("PATCH /api/users/:id:", e);
    res.status(500).json({ error: "server error" });
  }
});

// ===== 404 & error handlers
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

process.on("unhandledRejection", (reason) => console.error("UNHANDLED_REJECTION:", reason));
process.on("uncaughtException", (err) => console.error("UNCAUGHT_EXCEPTION:", err));

// ===== start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
});
