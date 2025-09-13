// User.jsx — простая фронт-модель без storage и без брони API
import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./Admin.css"; // используем твои существующие стили
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";
import "/src/components/calendarAdmin/CalendarAdmin.css";

const API = "https://hotelproject-8cip.onrender.com";

/* -------- Общая заглушка -------- */
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

/* -------- Нижняя навигация -------- */
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

/* -------- Детали объекта (картинка → заголовок/описание → календарь → кнопка) -------- */
function ObjectDetails({ obj, onBack }) {
  const [range, setRange] = React.useState(); // { from, to }

  function handleBook() {
    if (!range?.from || !range?.to) {
      alert("Выберите даты заезда и выезда");
      return;
    }
    // Пока без API — просто показываем, что всё ок
    const iso = (d) => d.toISOString().slice(0, 10);
    alert(`(MVP) Бронь: ${obj.title}\nс ${iso(range.from)} по ${iso(range.to)}`);
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

      {/* 1) Картинка */}
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

      {/* 2) Название и описание */}
      <h2 className="title" style={{ marginTop: 0 }}>{obj.title}</h2>
      {obj.description ? <p style={{ marginTop: 6 }}>{obj.description}</p> : null}

      {/* 3) Календарь + кнопка */}
      <div style={{ marginTop: 12 }}>
        <AdminCalendar
          months={2}
          bookedRanges={[]}        // пока нет данных — пусто
          selected={range}
          onSelectRange={setRange}
          readOnly={false}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn-primary" type="button" onClick={handleBook}>
            Забронировать
          </button>
        </div>
      </div>

      {/* 4) Контакты (карта позже) */}
      <div style={{ marginTop: 16 }}>
        {obj.owner_name ? <div className="text-sub">Владелец: {obj.owner_name}</div> : null}
        {obj.owner_contact ? <div className="text-sub">Контакт: {obj.owner_contact}</div> : null}
      </div>
    </div>
  );
}

/* -------- User Page -------- */
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
