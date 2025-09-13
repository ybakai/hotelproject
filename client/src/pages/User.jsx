// User.jsx
import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./Admin.css"; // используем существующие классы: .grid-2-12, .tile, .empty, .bottom и т.д.

const API = "https://hotelproject-8cip.onrender.com";

/* -------------------- Общая заглушка -------------------- */
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

/* -------------------- Нижняя навигация -------------------- */
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

/* -------------------- Список объектов -------------------- */
function ObjectsList({ onOpen }) {
  const [objects, setObjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const loadObjects = React.useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((data) => setObjects(Array.isArray(data) ? data : []))
      .catch((e) => console.error("objects load error:", e))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadObjects();
  }, [loadObjects]);

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
            {o.description ? (
              <div className="tile__sub">{o.description}</div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

/* -------------------- Детали объекта -------------------- */
function ObjectDetails({ obj, onBack }) {
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

      <h2 className="title" style={{ marginTop: 0 }}>{obj.title}</h2>

      {obj.description ? (
        <p style={{ marginTop: 8 }}>{obj.description}</p>
      ) : null}

      {Array.isArray(obj.images) && obj.images.length > 0 ? (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr" }}>
          {obj.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={obj.title || `image ${i + 1}`}
              style={{ width: "100%", borderRadius: 12 }}
            />
          ))}
        </div>
      ) : (
        <div className="tile__imgwrap tile__imgwrap--empty" style={{ marginTop: 8 }}>
          Нет фото
        </div>
      )}

      {/* Дополнительные поля, если есть */}
      <div style={{ marginTop: 12 }}>
        {obj.owner_name ? (
          <div className="text-sub">Владелец: {obj.owner_name}</div>
        ) : null}
        {obj.owner_contact ? (
          <div className="text-sub">Контакт: {obj.owner_contact}</div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------- User Page -------------------- */
export default function User() {
  const [page, setPage] = React.useState("objects");
  const [openedObject, setOpenedObject] = React.useState(null);

  const renderContent = () => {
    if (page === "objects") {
      if (openedObject) {
        return (
          <ObjectDetails
            obj={openedObject}
            onBack={() => setOpenedObject(null)}
          />
        );
        }
      return <ObjectsList onOpen={setOpenedObject} />;
    }
    if (page === "exchange") {
      return (
        <EmptyScreen
          title="Обмен домами"
          note="Позже подключим логику обмена."
        />
      );
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
