import { useState, useMemo } from "react";
import "./Authform.css";

export default function Authform({ onSubmitLogin, onSubmitRegister }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailValid = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const passValid = useMemo(() => password.length >= 6, [password]);
  const canSubmit = emailValid && passValid && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!emailValid) return setError("Введите корректный e-mail");
    if (!passValid) return setError("Пароль не короче 6 символов");
    setLoading(true);
    try {
      if (mode === "login") {
        await (onSubmitLogin?.(email, password) ?? new Promise(r => setTimeout(r, 500)));
      } else {
        await (onSubmitRegister?.(email, password) ?? new Promise(r => setTimeout(r, 500)));
      }
    } catch (e) {
      setError(e?.message || "Ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      {/* центрируем форму во весь экран */}
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
              placeholder="минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`auth__input ${password && !passValid ? "is-error" : ""}`}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div className="auth__error">{error}</div>}

          <button className="auth__btn" type="submit" disabled={!canSubmit}>
            {loading ? "Отправка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          <p className="auth__hint">
            {mode === "login"
              ? "Введите e-mail и пароль для входа."
              : "Заполните e-mail и пароль для регистрации."}
          </p>
        </form>
      </div>

      {/* табы внизу, под карточкой */}
      <div className="auth__tabs">
        <button
          className={`auth__tab ${mode === "login" ? "is-active" : ""}`}
          onClick={() => { setMode("login"); setError(""); }}
          type="button"
        >
          Вход
        </button>
        <button
          className={`auth__tab ${mode === "register" ? "is-active" : ""}`}
          onClick={() => { setMode("register"); setError(""); }}
          type="button"
        >
          Регистрация
        </button>
      </div>
    </div>
  );
}
