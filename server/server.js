import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Pool } from "pg";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONT_ORIGIN = process.env.APP_URL || true; // можно указать домен фронта

// ===== DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon/Render/Vercel
});

// ===== Cloudinary (для картинок объектов)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // обязателен
  api_key: process.env.CLOUDINARY_API_KEY,       // обязателен
  api_secret: process.env.CLOUDINARY_API_SECRET, // обязателен
});

// ===== Multer (приём файлов в память)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB на файл
});

// ===== middlewares
app.use(cors({ origin: FRONT_ORIGIN, credentials: true }));
app.use(express.json());

// ===== ping
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is up 🚀" });
});

// ===================== USERS =====================

// GET /api/users
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

// допустимые статусы
const ALLOWED = new Set(["lead", "owner", "client"]);

// PUT /api/users/:id/status  { "status": "lead" }
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
// Таблица: objects(id, owner_id, title, description, images[], created_at)

// GET /api/objects?owner_id=123  — список (всех или по владельцу)
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

// GET /api/users/:id/objects — объекты конкретного пользователя
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

// POST /api/objects — создать объект (multipart/form-data)
// поля: title (обяз.), description (опц.), owner_id (опц.), images[] (опц., до 6 шт.)
app.post("/api/objects", upload.array("images", 6), async (req, res) => {
  try {
    const { title, description, owner_id } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    // 1) загрузить картинки в Cloudinary, получить secure_url
    const urls = [];
    for (const file of req.files || []) {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "hotel_objects" },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(file.buffer);
      });
      urls.push(uploaded.secure_url);
    }

    // 2) сохранить объект в БД
    const { rows } = await pool.query(
      `INSERT INTO objects (owner_id, title, description, images)
       VALUES ($1, $2, $3, $4)
       RETURNING id, owner_id, title, description, images, created_at`,
      [owner_id ? Number(owner_id) : null, title, description || null, urls]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /api/objects:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ===================== HEALTH & AUTH (как у тебя) =====================

// healthz (DB)
app.get("/healthz", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: r.rows[0].now });
  } catch (err) {
    console.error("healthz error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// register
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

// login
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

// 404
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

// глобальные ловушки
process.on("unhandledRejection", (reason) => console.error("UNHANDLED_REJECTION:", reason));
process.on("uncaughtException", (err) => console.error("UNCAUGHT_EXCEPTION:", err));

// start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
});
