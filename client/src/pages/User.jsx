// User.jsx
import React from "react";
import { ChevronRight, RefreshCw, Bell, Shield, Globe, X } from "lucide-react";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";
import "/src/components/calendarAdmin/CalendarAdmin.css";

const API = "https://hotelproject-8cip.onrender.com";

/* ---------- Простая модалка ---------- */
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

/* ---------- Плашка/ввод ---------- */
function Field({ label, children }) {
  return (
    <label className="form__group" style={{ marginBottom: 12 }}>
      {label ? <span className="form__label">{label}</span> : null}
      {children}
    </label>
  );
}

/* ---------- Список заявок пользователя ---------- */
function BookingsList({ userId }) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/api/bookings`);
      const data = await res.json();

      const uid = Number(userId);
      const arr = Array.isArray(data) ? data : [];

      // Предпочитаем фильтр по user_id; если его нет в данных — пытаемся по name (на всякий случай)
      const mine = arr.filter((b) => {
        if (typeof b.user_id !== "undefined" && b.user_id !== null) {
          return Number(b.user_id) === uid;
        }
        // fallback (не идеально, но лучше чем ничего)
        return false;
      });

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

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

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

/* ---------- Детали объекта (оставил, если будешь переиспользовать) ---------- */
function ObjectDetails({ obj, user, onBack }) {
  const [range, setRange] = React.useState();
  const [loading, setLoading] = React.useState(false);
  const [bookedRanges, setBookedRanges] = React.useState([]);

  React.useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch(`${API}/api/bookings`);
        const data = await res.json();
        const confirmed = (Array.isArray(data) ? data : []).filter(
          (b) => b.status === "confirmed" && b.object_id === obj.id
        );
        setBookedRanges(
          confirmed.map((b) => ({
            start: b.start_date.slice(0, 10),
            end: b.end_date.slice(0, 10),
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
        <div className="tile__imgwrap tile__imgwrap--empty" style={{ marginBottom: 12 }}>
          Нет фото
        </div>
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
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
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

/* ---------- Профиль (как на макете) ---------- */
export default function User({ user }) {
  // локальные поля (редактирование UI, без сохранения — при необходимости подключим API)
  const [fullName, setFullName] = React.useState(user?.full_name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [lang, setLang] = React.useState("ru");
  const [notify, setNotify] = React.useState(true);

  // модалка «Проверка заявки»
  const [openCheck, setOpenCheck] = React.useState(false);

  return (
    <div className="app">
      <main className="container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="title" style={{ marginTop: 4, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Профиль</span>
            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                background: "rgba(0,0,0,.06)",
                borderRadius: 8,
                color: "var(--text, #fff)",
                opacity: 0.8,
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
          <button className="card row-btn" type="button" style={{ width: "100%", marginTop: 6 }}>
            <div className="row-btn__left">
              <Globe size={18} style={{ marginRight: 10 }} />
              Язык
            </div>
            <div className="row-btn__right">
              {lang === "ru" ? "Русский" : "English"}
              <ChevronRight size={18} style={{ marginLeft: 8 }} />
            </div>
          </button>

          {/* Уведомления */}
          <div className="card row-btn" style={{ width: "100%", marginTop: 8 }}>
            <div className="row-btn__left">
              <Bell size={18} style={{ marginRight: 10 }} />
              Уведомления
            </div>
            <div className="row-btn__right">
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
          <button className="card row-btn" type="button" style={{ width: "100%", marginTop: 8 }}>
            <div className="row-btn__left">
              <Shield size={18} style={{ marginRight: 10 }} />
              Безопасность
            </div>
            <div className="row-btn__right">
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
      </main>

      {/* Модалка «Проверка заявки» */}
      <Modal open={openCheck} onClose={() => setOpenCheck(false)} title="Мои заявки">
        {user?.id ? (
          <BookingsList userId={user.id} />
        ) : (
          <div className="empty">Войдите в аккаунт, чтобы видеть заявки</div>
        )}
      </Modal>
    </div>
  );
}
