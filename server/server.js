import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();
const PORT = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // нужно для Neon
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const q = await pool.query(
      `SELECT id, email, password_hash, full_name, phone, role, created_at
       FROM users
       WHERE email = $1`,
      [String(email).toLowerCase().trim()]
    );

    if (q.rowCount === 0) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const user = q.rows[0];
    // В твоём MVP пароль хранится как есть в password_hash:
    if (user.password_hash !== String(password)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    // Успех
    delete user.password_hash; // не отдаём пароль наружу
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});


app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const q = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1,$2,$3,$4,'user')
       RETURNING id, email, role, full_name, phone, created_at`,
      [email.toLowerCase().trim(), password, fullName || null, phone || null]
    );

    res.json({ ok: true, user: q.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "email already exists" });
    }
    res.status(500).json({ error: "server error" });
  }
});

app.get("/healthz", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: r.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

console.log("DB URL:", process.env.DATABASE_URL);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
