// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Pool } from "pg";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONT_ORIGIN = process.env.APP_URL || true; // true — отражает Origin запроса

// ===== Cookies / JWT =====
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "PLEASE_CHANGE_ME_REFRESH_SECRET";
const REFRESH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней
const COOKIE_SECURE =
  (process.env.COOKIE_SECURE ?? "true").toLowerCase() !== "false";

function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}
function setRefreshCookie(res, token) {
  res.cookie("rt", token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "None",
    path: "/auth",
    maxAge: REFRESH_MAX_AGE_MS,
  });
}
function clearRefreshCookie(res) {
  res.clearCookie("rt", {
    path: "/auth",
    secure: COOKIE_SECURE,
    sameSite: "None",
    httpOnly: true,
  });
}

// ===== DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===== bootstrap schema
async function ensureSchema() {
  // исходная таблица exchanges
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
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_exchanges_user ON exchanges(user_id);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);`
  );

  // ДОБАВЛЯЕМ JSONB ПОЛЯ (контакты) — выполняется безопасно повторно
  await pool.query(`
    ALTER TABLE exchanges
      ADD COLUMN IF NOT EXISTS contact JSONB,
      ADD COLUMN IF NOT EXISTS shared_contacts JSONB
  `);
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

// ===== Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// ===== middlewares
app.use(
  cors({
    origin: FRONT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser()); // для httpOnly куки

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
  if (!ALLOWED.has(status)) return res.status(400).json({ error: "Invalid status" });

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

// УДАЛИТЬ пользователя
app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    // блокируем удаление, если он владелец объектов
    const dep = await pool.query(`SELECT 1 FROM objects WHERE owner_id = $1 LIMIT 1`, [id]);
    if (dep.rowCount > 0) {
      return res.status(409).json({ error: "user_has_objects" });
    }

    const q = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
    if (q.rowCount === 0) return res.status(404).json({ error: "not_found" });

    res.json({ ok: true, id: q.rows[0].id });
  } catch (e) {
    console.error("DELETE /api/users/:id", e);
    if (e.code === "23503") {
      // внешние зависимости (брони/обмены и т.д.)
      return res.status(409).json({ error: "user_has_dependencies" });
    }
    res.status(500).json({ error: "server error" });
  }
});

// Показать логин/пароль пользователя (для админки)
app.get("/api/users/:id/credentials", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const q = await pool.query(
      `SELECT id, email, password_hash FROM users WHERE id = $1`,
      [id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "not_found" });

    // ПРИМЕЧАНИЕ: password_hash хранит пароль как есть (как у тебя сейчас)
    const { email, password_hash } = q.rows[0];
    res.json({ ok: true, email, password: String(password_hash) });
  } catch (e) {
    console.error("GET /api/users/:id/credentials", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
});

// ===================== OBJECTS =====================
app.get("/api/objects", async (req, res) => {
  try {
    const { owner_id } = req.query;
    const q = owner_id
      ? {
          text: `SELECT * FROM objects WHERE owner_id = $1 ORDER BY created_at DESC`,
          values: [Number(owner_id)],
        }
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
      title,
      description,
      owner_id,
      owner_name,
      owner_contact,
      address,
      area,
      rooms,
      share,
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
      console.warn(
        "Images were sent but Cloudinary isn't configured — skipping upload."
      );
    }

    const areaNum =
      area !== undefined && area !== null && String(area).trim() !== ""
        ? Number(area)
        : null;
    const roomsInt =
      rooms !== undefined && rooms !== null && String(rooms).trim() !== ""
        ? parseInt(rooms, 10)
        : null;

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

// РЕГИСТРАЦИЯ
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const q = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1,$2,$3,$4,'user')
       RETURNING id, email, role, full_name, phone, created_at`,
      [
        String(email).toLowerCase().trim(),
        String(password),
        fullName || null,
        phone || null,
      ]
    );

    res.json({ ok: true, user: q.rows[0] });
  } catch (err) {
    console.error("register error:", err);
    if (err.code === "23505")
      return res.status(409).json({ error: "email already exists" });
    res.status(500).json({ error: "server error" });
  }
});

// ЛОГИН (httpOnly кука)
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const q = await pool.query(
      `SELECT id, email, password_hash, full_name, phone, role, created_at
       FROM users WHERE email = $1`,
      [String(email).toLowerCase().trim()]
    );

    if (q.rowCount === 0)
      return res.status(401).json({ error: "invalid_credentials" });

    const user = q.rows[0];
    if (String(user.password_hash) !== String(password)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    delete user.password_hash;

    const token = signRefreshToken({ uid: user.id });
    setRefreshCookie(res, token);

    res.json({ ok: true, user });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// Текущий пользователь по куке
app.get("/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.rt;
    if (!token) return res.status(401).json({ error: "no_token" });

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const q = await pool.query(
      `SELECT id, email, full_name, phone, role, created_at
       FROM users WHERE id = $1`,
      [decoded.uid]
    );
    if (q.rowCount === 0)
      return res.status(401).json({ error: "user_not_found" });

    res.json({ ok: true, user: q.rows[0] });
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
});

// Обновить куку (ротация)
app.post("/auth/refresh", async (req, res) => {
  try {
    const token = req.cookies?.rt;
    if (!token) return res.status(401).json({ error: "no_token" });

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const newToken = signRefreshToken({ uid: decoded.uid });
    setRefreshCookie(res, newToken);

    res.json({ ok: true });
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
});

// Выход
app.post("/auth/logout", async (_req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ===================== BOOKINGS =====================
// создать бронь (с проверкой пересечений)
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      objectId,
      startDate,
      endDate,
      guests = 1,
      note = null,
      userId,
    } = req.body || {};

    if (!objectId || !startDate || !endDate || !userId) {
      return res
        .status(400)
        .json({ error: "objectId, userId, startDate, endDate обязательны" });
    }

    const conflict = await pool.query(
      `SELECT 1
         FROM bookings
        WHERE object_id = $1::int
          AND status IN ('pending','confirmed')
          AND NOT ($2::date > end_date OR $3::date < start_date)
        LIMIT 1`,
      [objectId, startDate, endDate]
    );
    if (conflict.rowCount > 0) {
      return res.status(409).json({ error: "Эти даты уже заняты" });
    }

    const ins = await pool.query(
      `INSERT INTO bookings (object_id, user_id, status, start_date, end_date, guests, note)
       VALUES ($1::int, $2::int, 'pending', $3::date, $4::date, $5::int, $6)
       RETURNING *;`,
      [objectId, userId, startDate, endDate, guests, note]
    );

    res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: err?.message || "server_error" });
  }
});

// получить все бронирования
app.get("/api/bookings", async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT b.id, b.start_date, b.end_date, b.status,
              b.object_id, b.user_id, b.created_at,
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
    const q = await pool.query(`DELETE FROM bookings WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);
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

// список обменов (?user_id= опционально) — отдаем картинки, контакт и shared_contacts
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
             bo.object_id            AS base_object_id,
             obase.title             AS base_object_title,
             otarget.title           AS target_object_title,
             otarget.images          AS target_object_images,
             e.contact               AS contact,
             e.shared_contacts       AS shared_contacts
      FROM exchanges e
      LEFT JOIN bookings bo      ON bo.id    = e.base_booking_id
      LEFT JOIN objects  obase   ON obase.id = bo.object_id
      LEFT JOIN objects  otarget ON otarget.id = e.target_object_id
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

// входящие обмены: заявки на МОИ объекты (я владелец target_object)
app.get("/api/exchanges/incoming", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id required" });

    const q = await pool.query(
      `
      SELECT e.*,
             bo.object_id            AS base_object_id,
             obase.title             AS base_object_title,
             otarget.title           AS target_object_title,
             otarget.images          AS target_object_images,
             otarget.owner_id        AS target_owner_id,
             e.contact               AS contact,
             e.shared_contacts       AS shared_contacts
      FROM exchanges e
      LEFT JOIN bookings bo      ON bo.id    = e.base_booking_id
      LEFT JOIN objects  obase   ON obase.id = bo.object_id
      LEFT JOIN objects  otarget ON otarget.id = e.target_object_id
      WHERE otarget.owner_id = $1
      ORDER BY e.created_at DESC
      `,
      [userId]
    );

    res.json(q.rows);
  } catch (e) {
    console.error("GET /api/exchanges/incoming", e);
    res.status(500).json({ error: "server error" });
  }
});

// СОЗДАТЬ запрос на обмен (с контактами инициатора)
app.post("/api/exchanges", async (req, res) => {
  try {
    const {
      userId,
      baseBookingId,
      targetObjectId,
      startDate,
      endDate,
      message = null,
      contact = null, // { name, phone, email, channel }
    } = req.body || {};
    if (!userId || !baseBookingId || !targetObjectId || !startDate || !endDate) {
      return res.status(400).json({
        error:
          "userId, baseBookingId, targetObjectId, startDate, endDate обязательны",
      });
    }

    const baseQ = await pool.query(
      `SELECT b.*, o.title AS base_object_title
         FROM bookings b
    LEFT JOIN objects  o ON o.id = b.object_id
        WHERE b.id = $1`,
      [Number(baseBookingId)]
    );
    if (baseQ.rowCount === 0)
      return res.status(404).json({ error: "base booking not found" });
    const base = baseQ.rows[0];
    if (Number(base.user_id) !== Number(userId))
      return res.status(403).json({ error: "not owner of booking" });
    if (base.status !== "confirmed")
      return res.status(400).json({ error: "исходная бронь должна быть подтверждена" });

    const baseNights = Math.max(
      1,
      Math.round(
        (new Date(base.end_date) - new Date(base.start_date)) / 86400000
      )
    );
    const selNights = Math.max(
      1,
      Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
    );
    if (baseNights !== selNights)
      return res.status(400).json({ error: `нужно выбрать ровно ${baseNights} ночей` });

    if (Number(base.object_id) === Number(targetObjectId))
      return res.status(400).json({ error: "нужно выбрать другой дом" });

    const conflict = await pool.query(
      `SELECT 1 FROM bookings 
        WHERE object_id = $1::int
          AND status IN ('pending','confirmed')
          AND NOT ($2::date > end_date OR $3::date < start_date)
        LIMIT 1`,
      [targetObjectId, startDate, endDate]
    );
    if (conflict.rowCount > 0)
      return res.status(409).json({ error: "на выбранные даты дом занят" });

    const ins = await pool.query(
      `INSERT INTO exchanges
         (user_id, base_booking_id, target_object_id, start_date, end_date, nights, message, status, contact)
       VALUES ($1::int,$2::int,$3::int,$4::date,$5::date,$6::int,$7,'pending',$8::jsonb)
       RETURNING *`,
      [userId, baseBookingId, targetObjectId, startDate, endDate, baseNights, message, contact ? JSON.stringify(contact) : null]
    );

    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("POST /api/exchanges", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
});

// изменить статус обмена + обмен контактами
app.patch("/api/exchanges/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { action } = req.body || {}; // "approve" | "reject" | "share_contacts"
    const id = Number(req.params.id);
    if (!id || !["approve", "reject", "share_contacts"].includes(action)) {
      return res.status(400).json({ error: "invalid input" });
    }

    await client.query("BEGIN");

    const q = await client.query(
      `SELECT * FROM exchanges WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (q.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    const ex = q.rows[0];

    // Подтянуть связанные сущности
    const baseQ = await client.query(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [ex.base_booking_id]
    );
    if (baseQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "base booking not found" });
    }
    const base = baseQ.rows[0];

    const targetObjQ = await client.query(
      `SELECT id, owner_id, images FROM objects WHERE id = $1`,
      [ex.target_object_id]
    );
    if (targetObjQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "target object not found" });
    }
    const targetObj = targetObjQ.rows[0];

    // === SHARE CONTACTS ===
    if (action === "share_contacts") {
      const ownerQ = await client.query(
        `SELECT id, full_name, phone, email FROM users WHERE id = $1`,
        [targetObj.owner_id]
      );
      const owner = ownerQ.rows[0] || null;

      const mine = {
        name: owner?.full_name || null,
        phone: owner?.phone || null,
        email: owner?.email || null,
      };
      const their = ex.contact || null;

      const shared = { mine, their };

      const upd = await client.query(
        `UPDATE exchanges
            SET shared_contacts = $2::jsonb
          WHERE id = $1
          RETURNING *`,
        [id, JSON.stringify(shared)]
      );

      await client.query("COMMIT");
      return res.json(upd.rows[0]);
    }

    // Нельзя менять уже решённые
    if (ex.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "already decided" });
    }

    // === REJECT ===
    if (action === "reject") {
      const upd = await client.query(
        `UPDATE exchanges SET status='rejected', decided_at=NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query("COMMIT");
      return res.json(upd.rows[0]);
    }

    // === APPROVE ===
    // 1) Проверим конфликт по целевому объекту
    const conflictTarget = await client.query(
      `SELECT 1 FROM bookings 
        WHERE object_id = $1::int 
          AND id <> $2::int
          AND status IN ('pending','confirmed')
          AND NOT ($3::date > end_date OR $4::date < start_date)
        LIMIT 1`,
      [ex.target_object_id, base.id, ex.start_date, ex.end_date]
    );
    if (conflictTarget.rowCount > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "даты уже заняты на целевом объекте, подтвердить невозможно" });
    }

    // 2) Сохраним исходные параметры инициатора — для встречной брони
    const origStart = base.start_date;
    const origEnd = base.end_date;
    const baseObjectId = base.object_id;

    // 3) Перенесём бронь инициатора на target_object и новые даты
    const updBooking = await client.query(
      `UPDATE bookings
          SET object_id = $1::int,
              start_date = $2::date,
              end_date   = $3::date,
              status     = 'confirmed'
        WHERE id = $4::int
        RETURNING *`,
      [ex.target_object_id, ex.start_date, ex.end_date, base.id]
    );

    // 4) Создадим встречную бронь владельцу target_object на старые даты инициатора
    const insPeer = await client.query(
      `INSERT INTO bookings (object_id, user_id, status, start_date, end_date, guests, note)
       VALUES ($1::int, $2::int, 'confirmed', $3::date, $4::date, 1, $5)
       RETURNING *`,
      [
        baseObjectId,
        targetObj.owner_id,
        origStart,
        origEnd,
        `created by exchange #${id}`,
      ]
    );

    // 5) Отметим обмен подтверждённым
    const updEx = await client.query(
      `UPDATE exchanges
          SET status='approved', decided_at=NOW()
        WHERE id = $1
        RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    res.json({
      exchange: updEx.rows[0],
      booking_initiator: updBooking.rows[0],
      booking_owner_peer: insPeer.rows[0],
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PATCH /api/exchanges/:id", e);
    res.status(500).json({ error: e?.message || "server error" });
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
    if (e.code === "23505")
      return res.status(409).json({ error: "email already exists" });
    console.error("PATCH /api/users/:id:", e);
    res.status(500).json({ error: "server error" });
  }
});

// ===== 404 & error handlers
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

process.on("unhandledRejection", (reason) =>
  console.error("UNHANDLED_REJECTION:", reason)
);
process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT_EXCEPTION:", err)
);

// ===== start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
});
