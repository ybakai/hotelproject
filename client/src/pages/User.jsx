// User.jsx
import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";
import "/src/components/calendarAdmin/CalendarAdmin.css";

/* === ДОБАВИЛ: иконки для профиля/модалки === */
import { ChevronRight, Globe, Bell, Shield, X } from "lucide-react";
/* === /добавил === */

const API = "https://hotelproject-8cip.onrender.com";

/* -------- Заглушка -------- */
function EmptyScreen({ title, note }) {
  return (
    <div className="empty">
      <div>
        <div className="empty__title">{title}</div>
        <div className="empty__note">{note || "Здесь будет контент."}</div>
      </div>
    </div>
  );
}

/* -------- Нижнее меню -------- */
function BottomNav({ current, onChange }) {
  const items = [
    { key: "objects", label: "Объекты", icon: <Home size={20} /> },
    { key: "exchange", label: "Обмен", icon: <RefreshCw size={20} /> },
    { key: "profile", label: "Профиль", icon: <UserCircle2 size={20} /> },
  ];
  return (
    <nav className="bottom">
      <div className="bottom__wrap">
        <div className="bottom__grid">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`bottom__btn ${current === it.key ? "is-active" : ""}`}
              type="button"
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

/* -------- Список объектов -------- */
function ObjectsList({ onOpen }) {
  const [objects, setObjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((data) => setObjects(Array.isArray(data) ? data : []))
      .catch((e) => console.error("objects load error:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Загрузка…</div>;
  if (objects.length === 0) return <div className="empty">Объектов пока нет</div>;

  return (
    <div className="grid-2-12">
      {objects.map((o) => (
        <button
          key={o.id}
          type="button"
          className="tile"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onOpen(o)}
        >
          {Array.isArray(o.images) && o.images[0] ? (
            <div className="tile__imgwrap">
              <img className="tile__img" src={o.images[0]} alt={o.title} />
            </div>
          ) : (
            <div className="tile__imgwrap tile__imgwrap--empty">Нет фото</div>
          )}
          <div className="tile__body">
            <div className="tile__title">{o.title}</div>
            {o.description ? <div className="tile__sub">{o.description}</div> : null}
          </div>
        </button>
      ))}
    </div>
  );
}

/* -------- Детали объекта -------- */
function ObjectDetails({ obj, user, onBack }) {
  const [range, setRange] = React.useState(); // { from, to }
  const [loading, setLoading] = React.useState(false);
  const [bookedRanges, setBookedRanges] = React.useState([]);

  // Загружаем подтверждённые брони для текущего объекта
  React.useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch(`${API}/api/bookings`);
        const data = await res.json();

        const confirmed = (Array.isArray(data) ? data : []).filter(
          (b) => b.status === "confirmed" && b.object_id === obj.id
        );

        // нормализуем даты
        setBookedRanges(
          confirmed.map((b) => ({
            start: b.start_date.slice(0, 10), // YYYY-MM-DD
            end: b.end_date.slice(0, 10),     // YYYY-MM-DD
          }))
        );
      } catch (err) {
        console.error("Ошибка загрузки броней:", err);
      }
    }

    loadBookings();
  }, [obj.id]);

  async function handleBook() {
    if (!range?.from || !range?.to) {
      alert("Выберите даты заезда и выезда");
      return;
    }
    if (!user?.id) {
      alert("❌ Нет user.id — повторите вход");
      return;
    }

    const iso = (d) => d.toISOString().slice(0, 10);

    try {
      setLoading(true);
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectId: obj.id,
          userId: user.id,
          startDate: iso(range.from),
          endDate: iso(range.to),
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        alert(`✅ Заявка создана!\nID: ${booking.id}\nСтатус: ${booking.status}`);
      } else if (res.status === 409) {
        alert("❌ Эти даты уже заняты!");
      } else {
        const text = await res.text();
        alert("Ошибка: " + text);
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Сеть/сервер недоступны");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <button className="btn-secondary" type="button" onClick={onBack} style={{ marginBottom: 12 }}>
        ← Назад
      </button>

      {Array.isArray(obj.images) && obj.images[0] ? (
        <img src={obj.images[0]} alt={obj.title} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
      ) : (
        <div className="tile__imgwrap tile__imgwrap--empty" style={{ marginBottom: 12 }}>Нет фото</div>
      )}

      <h2 className="title" style={{ marginTop: 0 }}>{obj.title}</h2>
      {obj.description ? <p style={{ marginTop: 6 }}>{obj.description}</p> : null}

      <div style={{ marginTop: 12 }}>
        <AdminCalendar
          months={1}
          bookedRanges={bookedRanges}
          selected={range}
          onSelectRange={setRange}
          readOnly={false}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn-primary" type="button" onClick={handleBook} disabled={loading}>
            {loading ? "Бронируем..." : "Забронировать"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {obj.owner_name ? <div className="text-sub">Владелец: {obj.owner_name}</div> : null}
        {obj.owner_contact ? <div className="text-sub">Контакт: {obj.owner_contact}</div> : null}
      </div>
    </div>
  );
}

/* === ДОБАВИЛ: простая модалка === */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="modal__close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
/* === /добавил === */

/* === ДОБАВИЛ: поле формы для профиля === */
function Field({ label, children }) {
  return (
    <label className="form__group" style={{ marginBottom: 12 }}>
      {label ? <span className="form__label">{label}</span> : null}
      {children}
    </label>
  );
}
/* === /добавил === */

/* === ДОБАВИЛ: список заявок пользователя для модалки === */
function BookingsList({ userId }) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState("");

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/api/bookings`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const mine = arr.filter((b) => Number(b.user_id) === Number(userId));
      setItems(mine);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="empty">Загрузка…</div>;
  if (error) return <div className="empty">Ошибка: {error}</div>;
  if (!items.length) return <div className="empty">Заявок пока нет</div>;

  return (
    <div className="vstack-12">
      <div className="hstack-8" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary" type="button" onClick={load}>
          <RefreshCw size={16} style={{ marginRight: 6 }} />
          Обновить
        </button>
      </div>

      {items.map((b) => (
        <div key={b.id} className="booking-card">
          <div className="booking-header">{b.object_title || "Объект"}</div>
          <div className="booking-sub">
            📅 {fmt(b.start_date)} → {fmt(b.end_date)}
          </div>
          <div className={`booking-status ${b.status}`} style={{ marginTop: 6 }}>
            {b.status === "pending"
              ? "⏳ Ожидает подтверждения"
              : b.status === "confirmed"
              ? "✅ Подтверждено"
              : "❌ Отклонено"}
          </div>
        </div>
      ))}
    </div>
  );
}
/* === /добавил === */

/* -------- Страница пользователя -------- */
export default function User({ user }) {
  const [page, setPage] = React.useState("objects");
  const [openedObject, setOpenedObject] = React.useState(null);

  /* === ДОБАВИЛ: состояние профиля и модалки проверки заявки === */
  const [fullName, setFullName] = React.useState(user?.full_name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [lang, setLang] = React.useState("ru");
  const [notify, setNotify] = React.useState(true);
  const [openCheck, setOpenCheck] = React.useState(false);
  /* === /добавил === */

  const renderContent = () => {
    if (!user?.id) {
      return <EmptyScreen title="Не авторизованы" note="Войдите, чтобы оформить бронь." />;
    }

    if (page === "objects") {
      if (openedObject) {
        return <ObjectDetails obj={openedObject} user={user} onBack={() => setOpenedObject(null)} />;
      }
      return <ObjectsList onOpen={setOpenedObject} />;
    }
    if (page === "exchange") {
      return <EmptyScreen title="Обмен домами" note="Позже подключим логику обмена." />;
    }

    /* === ЗАМЕНА ПРОФИЛЯ: вместо EmptyScreen рендерим экран профиля === */
    return (
      <div className="card" style={{ padding: 16, maxWidth: 520, marginInline: "auto" }}>
        <div
          className="title"
          style={{
            marginTop: 4,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Профиль</span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              background: "rgba(0,0,0,.06)",
              borderRadius: 8,
              opacity: 0.85,
            }}
          >
            1/8
          </span>
        </div>

        <Field>
          <input
            className="input"
            placeholder="Иван Иванов"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field>
          <input
            className="input"
            placeholder="mail@demo.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field>
          <input
            className="input"
            placeholder="+7 930 245 15 20"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        {/* Язык */}
        <button
          className="card"
          type="button"
          style={{
            width: "100%",
            padding: "12px 14px",
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
            <Globe size={18} />
            Язык
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", opacity: 0.9 }}>
            {lang === "ru" ? "Русский" : "English"}
            <ChevronRight size={18} style={{ marginLeft: 8 }} />
          </div>
        </button>

        {/* Уведомления */}
        <div
          className="card"
          style={{
            width: "100%",
            padding: "12px 14px",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
            <Bell size={18} />
            Уведомления
          </div>
          <div style={{ display: "inline-flex", alignItems: "center" }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
        </div>

        {/* Безопасность */}
        <button
          className="card"
          type="button"
          style={{
            width: "100%",
            padding: "12px 14px",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
            <Shield size={18} />
            Безопасность
          </div>
          <div>
            <ChevronRight size={18} />
          </div>
        </button>

        {/* Проверка заявки */}
        <div style={{ marginTop: 20 }}>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setOpenCheck(true)}
            style={{ width: "100%" }}
          >
            Проверка заявки
          </button>
        </div>
      </div>
    );
    /* === /замена === */
  };

  return (
    <div className="app" style={{ paddingBottom: 80 }}>
      <main className="container">{renderContent()}</main>
      <BottomNav current={page} onChange={setPage} />

      {/* === ДОБАВИЛ: модалка «Проверка заявки» === */}
      <Modal open={openCheck} onClose={() => setOpenCheck(false)} title="Мои заявки">
        {user?.id ? (
          <BookingsList userId={user.id} />
        ) : (
          <div className="empty">Войдите в аккаунт, чтобы видеть заявки</div>
        )}
      </Modal>
      {/* === /добавил === */}
    </div>
  );
}
