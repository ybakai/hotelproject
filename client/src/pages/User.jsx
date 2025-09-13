// User.jsx
import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";
import "/src/components/calendarAdmin/CalendarAdmin.css";

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
function ObjectDetails({ obj, onBack }) {
  const [range, setRange] = React.useState(); // { from, to }
  const [loading, setLoading] = React.useState(false);

  async function handleBook() {
    if (!range?.from || !range?.to) {
      alert("Выберите даты заезда и выезда");
      return;
    }

    // userId берём из localStorage (сохраняется после логина)
    const stored = localStorage.getItem("user");
    let loggedUser = null;
    try {
      loggedUser = stored ? JSON.parse(stored) : null;
    } catch {
      loggedUser = null;
    }

    if (!loggedUser?.id) {
      alert("❌ Не найден userId — сначала войдите");
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
          userId: loggedUser.id, // 👈 id пользователя
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
      <button
        className="btn-secondary"
        type="button"
        onClick={onBack}
        style={{ marginBottom: 12 }}
      >
        ← Назад
      </button>

      {Array.isArray(obj.images) && obj.images[0] ? (
        <img
          src={obj.images[0]}
          alt={obj.title}
          style={{ width: "100%", borderRadius: 12, marginBottom: 12 }}
        />
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
          bookedRanges={[]} // пока пусто
          selected={range}
          onSelectRange={setRange}
          readOnly={false}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            className="btn-primary"
            type="button"
            onClick={handleBook}
            disabled={loading}
          >
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

/* -------- Страница пользователя -------- */
export default function User() {
  const [page, setPage] = React.useState("objects");
  const [openedObject, setOpenedObject] = React.useState(null);

  const renderContent = () => {
    if (page === "objects") {
      if (openedObject) {
        return <ObjectDetails obj={openedObject} onBack={() => setOpenedObject(null)} />;
      }
      return <ObjectsList onOpen={setOpenedObject} />;
    }
    if (page === "exchange") {
      return <EmptyScreen title="Обмен домами" note="Позже подключим логику обмена." />;
    }
    return <EmptyScreen title="Профиль" note="Тут будет профиль пользователя." />;
  };

  return (
    <div className="app" style={{ paddingBottom: 80 }}>
      <main className="container">{renderContent()}</main>
      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
