import React from "react";
import { Home, RefreshCw, UserCircle2 } from "lucide-react";
import "./User.css";

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

function BottomNav({ current, onChange }) {
  const items = [
    { key: "objects", label: "Объекты", icon: <Home size={20} /> },
    { key: "exchange", label: "Обмен", icon: <RefreshCw size={20} /> },
    { key: "profile", label: "Профиль", icon: <UserCircle2 size={20} /> },
  ];

  return (
    <nav className="bottom bottom--dark">
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

export default function User() {
  const [page, setPage] = React.useState("objects");

  const renderContent = () => {
    if (page === "objects") {
      return (
        <EmptyScreen
          title="Объекты"
          note="Здесь появится список объектов и карточки."
        />
      );
    }
    if (page === "exchange") {
      return (
        <EmptyScreen
          title="Обмен домами"
          note="Позже подключим логику обмена."
        />
      );
    }
    return (
      <EmptyScreen
        title="Профиль"
        note="Тут будет профиль пользователя."
      />
    );
  };

  return (
    <div className="user-page">
      <main className="user-content">
        {renderContent()}
      </main>

      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
