// User.jsx
import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";
import "/src/components/calendarAdmin/CalendarAdmin.css";
import { ChevronRight, Globe, X } from "lucide-react";

const API = "https://hotelproject-8cip.onrender.com";

/* ---------- helpers ---------- */
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const fmtDateShort = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** Надёжно превращает Date/строку в 'YYYY-MM-DD' */
const toISODate = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // если уже YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v).slice(0, 10);
  // пробуем как обычную дату
  const d = new Date(v);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  // fallback: DD.MM.YYYY или DD/MM/YYYY
  const m = String(v).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d2 = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return d2.toISOString().slice(0, 10);
  }
  return "";
};

const nightsBetween = (start, end) => {
  const a = new Date(toISODate(start));
  const b = new Date(toISODate(end));
  const ms = b - a;
  return Math.max(1, Math.round(ms / 86400000));
};

/* ---------- UI primitives ---------- */
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

/* ---------- Список всех объектов (клиентский каталог) ---------- */
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
  if (objects.length === 0)
    return <div className="empty">Объектов пока нет</div>;

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
            {o.description ? (
              <div className="tile__sub">{o.description}</div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- Детали объекта + обычная бронь ---------- */
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
            start: toISODate(b.start_date),
            end: toISODate(b.end_date),
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
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectId: obj.id,
          userId: user.id,
          startDate: toISODate(range.from),
          endDate: toISODate(range.to),
        }),
      });
      if (res.ok) {
        alert(`✅ Заявка создана!`);
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

      <h2 className="title" style={{ marginTop: 0 }}>{obj.title}</h2>

      {Array.isArray(obj.images) && obj.images[0] ? (
        <img src={obj.images[0]} alt={obj.title} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
      ) : (
        <div className="tile__imgwrap tile__imgwrap--empty" style={{ marginBottom: 12 }}>Нет фото</div>
      )}

      {obj.description ? <p style={{ marginTop: 6 }}>{obj.description}</p> : null}

       {(obj?.rooms != null || obj?.area != null || (obj?.share !== undefined && obj?.share !== null && String(obj.share) !== "")) && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            {obj?.rooms != null && (
              <div>
                <div className="text-sub">Комнаты</div>
                <div style={{ fontWeight: 600 }}>{obj.rooms}</div>
              </div>
            )}
            {obj?.area != null && (
              <div>
                <div className="text-sub">Метраж</div>
                <div style={{ fontWeight: 600 }}>
                  {Number(obj.area).toLocaleString("ru-RU")} м²
                </div>
              </div>
            )}
            {(obj?.share !== undefined && obj?.share !== null && String(obj.share) !== "") && (
              <div>
                <div className="text-sub">Доли</div>
                <div style={{ fontWeight: 600 }}>
                  {/^\d+(\.\d+)?$/.test(String(obj.share)) ? `${obj.share}%` : String(obj.share)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
        {obj.owner_name ? <div className="text-sub">Имя: {obj.owner_name}</div> : null}
        {obj.owner_contact ? <div className="text-sub">Телефон/контакт: {obj.owner_contact}</div> : null}
      </div>
    </div>
  );
}

/* ---------- История exchange-заявок пользователя ---------- */
function ExchangeHistory({ userId }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/exchanges?user_id=${userId}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Загрузка…</div>;
  if (!items.length) return <div className="empty">Запросов пока нет</div>;

  return (
    <div className="vstack-12">
      <div className="hstack-8" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw size={16} style={{ marginRight: 6 }} />
          Обновить
        </button>
      </div>
      {items.map((x) => (
        <div key={x.id} className="booking-card">
          <div className="booking-header">Обмен #{x.id}</div>
          <div className="booking-sub">Дом: {x.base_object_title} → {x.target_object_title}</div>
          <div className="booking-sub">
            Даты: {fmtDateShort(x.start_date)} → {fmtDateShort(x.end_date)} ({x.nights} ноч.)
          </div>
          <div className={`booking-status ${x.status}`} style={{ marginTop: 6 }}>
            {x.status === "pending" ? "⏳ Ожидает" :
             x.status === "approved" ? "✅ Разрешено" :
             x.status === "rejected" ? "❌ Отклонено" : x.status}
          </div>
          {x.message ? <div className="booking-sub" style={{ marginTop: 6 }}>Сообщение: {x.message}</div> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- Экран «Обмен домами» ---------- */
function ExchangePage({ user }) {
  const [tab, setTab] = React.useState("objects"); // objects | history

  // шаги мастера
  const [step, setStep] = React.useState(1); // 1: choose booking, 2: choose target object, 3: choose dates + send
  const [myBookings, setMyBookings] = React.useState([]);
  const [allObjects, setAllObjects] = React.useState([]);

  const [baseBooking, setBaseBooking] = React.useState(null);
  const [targetObject, setTargetObject] = React.useState(null);
  const [targetBookedRanges, setTargetBookedRanges] = React.useState([]);
  const [targetRange, setTargetRange] = React.useState();
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const baseNights = baseBooking ? nightsBetween(baseBooking.start_date, baseBooking.end_date) : 0;

  // загрузка моих подтверждённых броней
  React.useEffect(() => {
    async function loadMyBookings() {
      try {
        const r = await fetch(`${API}/api/bookings`);
        const data = await r.json();
        const mine = (Array.isArray(data) ? data : []).filter(
          (b) => Number(b.user_id) === Number(user.id) && b.status === "confirmed"
        );
        setMyBookings(mine);
      } catch (e) {
        console.error(e);
      }
    }
    loadMyBookings();
  }, [user.id]);

  // список всех объектов (для шага 2)
  React.useEffect(() => {
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((d) => setAllObjects(Array.isArray(d) ? d : []))
      .catch((e) => console.error(e));
  }, []);

  // при выборе целевого объекта — грузим его занятые даты
  React.useEffect(() => {
    async function loadBookedRanges() {
      if (!targetObject) return;
      try {
        const r = await fetch(`${API}/api/bookings`);
        const data = await r.json();
        const busy = (Array.isArray(data) ? data : [])
          .filter((b) => b.object_id === targetObject.id && ["pending", "confirmed"].includes(b.status))
          .map((b) => ({ start: toISODate(b.start_date), end: toISODate(b.end_date) }));
        setTargetBookedRanges(busy);
      } catch (e) {
        console.error(e);
      }
    }
    loadBookedRanges();
  }, [targetObject]);

  function resetToStep1() {
    setStep(1);
    setBaseBooking(null);
    setTargetObject(null);
    setTargetBookedRanges([]);
    setTargetRange(undefined);
    setMessage("");
  }

  async function sendExchange() {
    if (!baseBooking || !targetObject) return;
    if (!targetRange?.from || !targetRange?.to) {
      alert("Выберите даты обмена");
      return;
    }
    const selNights = nightsBetween(targetRange.from, targetRange.to);
    if (selNights !== baseNights) {
      alert(`Нужно выбрать ровно ${baseNights} ноч.: выбранно ${selNights}`);
      return;
    }

    try {
      setSending(true);
      const res = await fetch(`${API}/api/exchanges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          baseBookingId: baseBooking.id,
          targetObjectId: targetObject.id,
          startDate: toISODate(targetRange.from),
          endDate: toISODate(targetRange.to),
          message: message?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "server error");
      alert("✅ Запрос на обмен отправлен!");
      // сброс мастера
      resetToStep1();
      setTab("history");
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      setSending(false);
    }
  }

  if (tab === "history") {
    return (
      <div style={{ padding: 16 }}>
        <div className="objects-toolbar" style={{ marginBottom: 12 }}>
          <div className="objects-title">Обмен неделями</div>
          <div className="hstack-8">
            <button className={`btn-secondary`} onClick={() => setTab("objects")}>
              Обмен
            </button>
            <button className={`btn-primary`} onClick={() => setTab("history")}>
              История
            </button>
          </div>
        </div>
        <ExchangeHistory userId={user.id} />
      </div>
    );
  }

  // TAB: objects (мастер обмена)
  return (
    <div style={{ padding: 16 }}>
      <div className="objects-toolbar" style={{ marginBottom: 12 }}>
        <div className="objects-title">Обмен неделями</div>
        <div className="hstack-8">
          <button className={`btn-primary`} onClick={() => setTab("objects")}>
            Обмен
          </button>
          <button className={`btn-secondary`} onClick={() => setTab("history")}>
            История
          </button>
        </div>
      </div>

      {step === 1 && (
        <>
          <div className="tile__title" style={{ marginBottom: 8 }}>1. Выберите вашу бронь</div>
          {myBookings.length === 0 ? (
            <div className="empty">У вас нет подтверждённых броней</div>
          ) : (
            <div className="vstack-12">
              {myBookings.map((b) => (
                <button
                  key={b.id}
                  className="booking-card"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => { setBaseBooking(b); setStep(2); }}
                >
                  <div className="booking-header">{b.object_title || "Объект"}</div>
                  <div className="booking-sub">📅 {fmtDate(b.start_date)} → {fmtDate(b.end_date)}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 2 && baseBooking && (
        <>
          <button className="btn-secondary" onClick={() => setStep(1)} style={{ marginBottom: 12 }}>
            ← Назад
          </button>
          <div className="tile__title" style={{ marginBottom: 8 }}>
            2. Выберите другой дом (длина проживания: {baseNights} ноч.)
          </div>
          <div className="grid-2-12">
            {allObjects
              .filter((o) => o.id !== baseBooking.object_id) // исключаем исходный дом
              .map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="tile"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => { setTargetObject(o); setStep(3); }}
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
        </>
      )}

      {step === 3 && baseBooking && targetObject && (
        <>
          <button className="btn-secondary" onClick={() => setStep(2)} style={{ marginBottom: 12 }}>
            ← Назад
          </button>
          <div className="tile__title" style={{ marginBottom: 8 }}>
            3. Выберите даты для обмена в «{targetObject.title}»
          </div>
          <AdminCalendar
            months={1}
            bookedRanges={targetBookedRanges}
            selected={targetRange}
            onSelectRange={setTargetRange}
            readOnly={false}
          />
          <div className="text-sub" style={{ marginTop: 8 }}>
            Нужно выбрать ровно {baseNights} ноч. (ваша исходная бронь: {fmtDateShort(baseBooking.start_date)} → {fmtDateShort(baseBooking.end_date)})
          </div>

          <label className="form__group" style={{ marginTop: 12 }}>
            <span className="form__label">Сообщение владельцу (опционально)</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Пару слов, почему хотите обмен…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          <div className="form__actions">
            <button className="btn-secondary" onClick={resetToStep1}>
              Отмена
            </button>
            <button className="btn-primary" onClick={sendExchange} disabled={sending}>
              {sending ? "Отправляем…" : "Отправить запрос"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Профиль / заявки (как у тебя) ---------- */
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

  React.useEffect(() => { load(); }, [load]);

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
          <div className="booking-sub">📅 {fmtDateShort(b.start_date)} → {fmtDateShort(b.end_date)}</div>
          <div className={`booking-status ${b.status}`} style={{ marginTop: 6 }}>
            {b.status === "pending" ? "⏳ Ожидает подтверждения" :
             b.status === "confirmed" ? "✅ Подтверждено" :
             b.status === "rejected" ? "❌ Отклонено" : "Статус: " + b.status}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Корневая страница пользователя ---------- */
export default function User({ user }) {
  const [page, setPage] = React.useState("objects");
  const [openedObject, setOpenedObject] = React.useState(null);

  // профиль
  const [fullName, setFullName] = React.useState(user?.full_name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [openCheck, setOpenCheck] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function saveProfile() {
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
    } catch (e) {
      console.error("save profile error:", e);
      alert("Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

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
      return <ExchangePage user={user} />;
    }

    // профиль
    return (
      <div className="card-profile" style={{ maxWidth: 560, marginInline: "auto" }}>
        <div className="profile-header">
          <button className="btn-primary" type="button" onClick={() => setEditing((v) => !v)} disabled={saving}>
            {editing ? "Готово" : "Изменить"}
          </button>
        </div>

        <label className="form__group">
          <input className="input" placeholder="Иван Иванов" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!editing || saving} />
        </label>

        <label className="form__group">
          <input className="input" placeholder="mail@demo.ru" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing || saving} />
        </label>

        <label className="form__group">
          <input className="input" placeholder="+7 930 245 15 20" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing || saving} />
        </label>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" type="button" onClick={saveProfile} disabled={saving || !editing}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn-secondary" type="button" onClick={() => setOpenCheck(true)} style={{ width: "100%" }}>
            Мои заявки (бронирования)
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app" style={{ paddingBottom: 80 }}>
      <div className="hedd">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" > <path d="M21 9.57232L10.9992 1L1 9.57232V21H21V9.57232ZM6.37495 20.4796H1.50704V10.099L6.37495 13.4779V20.4796ZM1.73087 9.62546L6.16178 5.82613L10.6308 9.58795L6.57594 12.9903L1.73087 9.62546ZM10.7632 14.5407L10.745 20.4796H6.88199V13.4076L10.7754 10.1396L10.7617 14.5407H10.7632ZM6.55919 5.48543L10.9992 1.67828L15.4743 5.51512L11.0327 9.25037L6.55919 5.48543ZM11.2703 14.9955H13V17.6789H11.2611V14.9955H11.2703ZM15.2748 13.4936V20.4796H11.2535L11.2611 18.1353H13.5086V14.5407H11.2718L11.2855 10.1365L11.2825 10.1334L15.2764 13.4857V13.4936H15.2748ZM20.4914 20.4796H15.7819V13.9202L20.4914 17.8836V20.4796ZM20.4914 17.21L16.059 13.4811L14.5135 12.1807L11.4317 9.58795L15.8702 5.85583L20.4899 9.81613V17.21H20.4914Z" fill="#276D73" stroke="#276D73" stroke-linejoin="round" /> </svg>
        <h1>TEST</h1>
      </div>
      
      <main className="container">{renderContent()}</main>
      
      <BottomNav current={page} onChange={setPage} />

      <Modal open={openCheck} onClose={() => setOpenCheck(false)} title="Мои заявки">
        {user?.id ? <BookingsList userId={user.id} /> : <div className="empty">Войдите в аккаунт, чтобы видеть заявки</div>}
      </Modal>
    </div>
  );
}
