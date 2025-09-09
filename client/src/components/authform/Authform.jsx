import { useState, useMemo } from "react";
import "./Authform.css";

export default function Authform() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // поля только для регистрации
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(""); // отображаемая строка с маской

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ===== helpers =====
  const emailValid = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const passValid = useMemo(() => password.length >= 6, [password]);

  // оставляем только цифры
  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const nameValid = useMemo(() => fullName.trim().length >= 2, [fullName]);
  const phoneValid = useMemo(() => phoneDigits.length >= 10, [phoneDigits]); // минимум 10 цифр

  const canSubmit =
    !loading &&
    emailValid &&
    passValid &&
    (mode === "login" ? true : nameValid && phoneValid);

  // простая маска: +X XXX XXX-XX-XX (по мере ввода)
  function formatPhoneMask(value) {
    const d = value.replace(/\D/g, "").slice(0, 15); // <=15 цифр по E.164
    if (!d) return "";
    let res = "+" + d[0];
    if (d.length > 1) res += " " + d.slice(1, 4);
    if (d.length > 4) res += " " + d.slice(4, 7);
    if (d.length > 7) res += "-" + d.slice(7, 9);
    if (d.length > 9) res += "-" + d.slice(9, 11);
    if (d.length > 11) res += " " + d.slice(11);
    return res;
  }

  function handlePhoneChange(e) {
    setPhone(formatPhoneMask(e.target.value));
  }

  // === запрос к API прямо отсюда ===
  const API = "https://hotelproject-8cip.onrender.com";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!emailValid) return setError("Введите корректный e-mail");
    if (!passValid) return setError("Пароль не короче 6 символов");
    if (mode === "register") {
      if (!nameValid) return setError("Укажите имя (минимум 2 символа)");
      if (!phoneValid) return setError("Укажите телефон (минимум 10 цифр)");
    }

    setLoading(true);
    try {
      if (mode === "login") {
        // Пока логин — заглушка
        setSuccess("Логин пока не реализован 🚧");
      } else {
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName: fullName.trim(),
            phone: phoneDigits,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data?.error === "email already exists") {
            throw new Error("Такой e-mail уже зарегистрирован");
          }
          throw new Error("Ошибка регистрации");
        }

        setSuccess("✅ Регистрация успешна!");
        console.log("User:", data.user);

        // Очистка полей
        setEmail("");
        setPassword("");
        setFullName("");
        setPhone("");
        setMode("login"); // переключаем на вкладку входа
      }
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {mode === "register" && (
            <>
              <label className="auth__label">
                <span>Имя</span>
                <input
                  type="text"
                  placeholder="Как к вам обращаться"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`auth__input ${fullName && !nameValid ? "is-error" : ""}`}
                  autoComplete="name"
                />
              </label>

              <label className="auth__label">
                <span>Телефон</span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+_ ___ ___-__-__"
                  value={phone}
                  onChange={handlePhoneChange}
                  className={`auth__input ${phone && !phoneValid ? "is-error" : ""}`}
                  autoComplete="tel"
                />
                <small className="auth__hint" style={{ marginTop: 4 }}>
                  Введите номер в международном формате. Пример: +48 600 000-000
                </small>
              </label>
            </>
          )}

          {error && <div className="auth__error">{error}</div>}
          {success && <div className="auth__success">{success}</div>}

          <button className="auth__btn" type="submit" disabled={!canSubmit}>
            {loading ? "Отправка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          <p className="auth__hint">
            {mode === "login"
              ? "Введите e-mail и пароль для входа."
              : "Укажите e-mail, пароль, имя и телефон для регистрации."}
          </p>
        </form>
      </div>

      <div className="auth__tabs">
        <button
          className={`auth__tab ${mode === "login" ? "is-active" : ""}`}
          onClick={() => {
            setMode("login");
            setError("");
            setSuccess("");
          }}
          type="button"
        >
          Вход
        </button>
        <button
          className={`auth__tab ${mode === "register" ? "is-active" : ""}`}
          onClick={() => {
            setMode("register");
            setError("");
            setSuccess("");
          }}
          type="button"
        >
          Регистрация
        </button>
      </div>
    </div>
  );
}
