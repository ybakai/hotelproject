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

// ===== Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Флаг — настроен ли Cloudinary
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

app.post("/api/objects", upload.array("images", 6), async (req, res) => {
  try {
    const { title, description, owner_id, owner_name, owner_contact } = req.body;

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

    const { rows } = await pool.query(
      `INSERT INTO objects (owner_id, title, description, images, owner_name, owner_contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, owner_id, title, description, images, owner_name, owner_contact, created_at`,
      [
        owner_id ? Number(owner_id) : null,
        title.trim(),
        description?.trim() || null,
        urls,
        owner_name?.trim() || null,
        owner_contact?.trim() || null,
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

// POST /api/bookings — создать заявку на бронь
// POST /api/bookings — создать заявку на бронь
app.post("/api/bookings", async (req, res) => {
  try {
    const { objectId, startDate, endDate, guests = 1, note = null, userId } = req.body;

    if (!objectId || !startDate || !endDate || !userId) {
      return res.status(400).json({ error: "objectId, userId, startDate, endDate обязательны" });
    }

    const query = `
      INSERT INTO bookings (object_id, user_id, status, start_date, end_date, guests, note)
      VALUES ($1, $2, 'pending', $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [objectId, userId, startDate, endDate, guests, note];

    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23P01") {
      return res.status(409).json({ error: "Эти даты уже заняты" });
    }
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// Получить все бронирования
// Получить все бронирования
app.get("/api/bookings", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT b.id, b.start_date, b.end_date, b.status,
              b.object_id,  -- 👈 добавляем
              u.full_name AS user_name,
              u.phone AS user_phone,
              o.title AS object_title
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN objects o ON b.object_id = o.id
       ORDER BY b.created_at DESC`
    );
    res.json(q.rows);
  } catch (err) {
    console.error("Error loading bookings:", err);
    res.status(500).json({ error: "server error" });
  }
});


// Изменить статус брони
app.patch("/api/bookings/:id", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "confirmed", "rejected"].includes(status)) {
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

// Обновить объект
app.patch("/api/objects/:id", upload.array("images", 6), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    // 1) текущая запись
    const curQ = await pool.query(`SELECT * FROM objects WHERE id = $1`, [id]);
    if (curQ.rowCount === 0) return res.status(404).json({ error: "not_found" });
    const cur = curQ.rows[0];

    // 2) поля из формы (multipart -> всё в строках)
    const title = (req.body.title ?? cur.title)?.trim();
    const description =
      (req.body.description ?? cur.description)?.trim() || null;
    const owner_name = (req.body.owner_name ?? cur.owner_name)?.trim() || null;
    const owner_contact =
      (req.body.owner_contact ?? cur.owner_contact)?.trim() || null;
    const owner_id = req.body.owner_id
      ? Number(req.body.owner_id)
      : cur.owner_id ?? null;

    // 3) обработка картинок
    // существующий массив
    let images = Array.isArray(cur.images) ? [...cur.images] : [];

    // (опционально) список URL, которые нужно удалить — приходит как JSON-массив строк
    // пример на фронте: fd.append("remove_images", JSON.stringify([url1, url2]))
    if (req.body.remove_images) {
      try {
        const toRemove = JSON.parse(req.body.remove_images);
        if (Array.isArray(toRemove) && toRemove.length) {
          images = images.filter((u) => !toRemove.includes(u));
        }
      } catch (e) {
        console.warn("remove_images parse error:", e);
      }
    }

    // новые файлы -> заливаем в Cloudinary (если настроен)
    if (Array.isArray(req.files) && req.files.length) {
      if (cloudOK) {
        for (const file of req.files) {
          const uploaded = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "hotel_objects" },
              (err, result) => (err ? reject(err) : resolve(result))
            );
            stream.end(file.buffer);
          });
          images.push(uploaded.secure_url);
        }
      } else {
        console.warn(
          "Images provided, but Cloudinary is not configured — skipping upload."
        );
      }
    }

    // 4) апдейт в БД
    const updQ = await pool.query(
      `UPDATE objects
         SET title = $1,
             description = $2,
             owner_id = $3,
             owner_name = $4,
             owner_contact = $5,
             images = $6
       WHERE id = $7
       RETURNING id, owner_id, title, description, images, owner_name, owner_contact, created_at`,
      [title, description, owner_id, owner_name, owner_contact, images, id]
    );

    res.json(updQ.rows[0]);
  } catch (e) {
    console.error("PATCH /api/objects/:id:", e);
    res.status(500).json({ error: e.message || "Server error" });
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
