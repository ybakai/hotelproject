import { useState, useMemo } from "react";
import "./Authform.css";

export default function Authform({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailValid = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const passValid = useMemo(() => password.length >= 6, [password]);

  const canSubmit = !loading && emailValid && passValid;

  const API = ""; // сюда вставь свой API URL

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!emailValid) return setError("Введите корректный e-mail");
    if (!passValid) return setError("Пароль не короче 6 символов");

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const msg =
          data?.error === "invalid_credentials"
            ? "Неверный e-mail или пароль"
            : data?.error || res.statusText || "Ошибка входа";
        throw new Error(msg);
      }

      onLoginSuccess?.(data.user);
    } catch (e) {
      setError(e?.message || "Ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__form-wrapper">
        <form className="auth__card" onSubmit={handleSubmit}>
          <label className="auth__label">
            <span>E-mail</span>
            <input
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`auth__input ${email && !emailValid ? "is-error" : ""}`}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
            />
          </label>

          <label className="auth__label">
            <span>Пароль</span>
            <input
              type="password"
              placeholder="Минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`auth__input ${password && !passValid ? "is-error" : ""}`}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="auth__error">{error}</div>}

          <button className="auth__btn" type="submit" disabled={!canSubmit}>
            {loading ? "Отправка…" : "Войти"}
          </button>

          <p className="auth__hint">Введите e-mail и пароль для входа.</p>
        </form>
      </div>
    </div>
  );
}
