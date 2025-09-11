import React, { useMemo, useState, useEffect } from "react";
import { Home, Users, CalendarDays, UserCircle2, Building2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Admin.css";

const API = "https://hotelproject-8cip.onrender.com";

const demoObjects = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: "Villa Fir",
  subtitle: "12 комнат",
}));

function SegmentedToggle({ value, onChange }) {
  const options = useMemo(
    () => [
      { key: "users", label: "Пользователи", icon: <Users size={16} /> },
      { key: "objects", label: "Объекты", icon: <Building2 size={16} /> },
    ],
    []
  );

  const activeIndex = options.findIndex((o) => o.key === value);

  return (
    <div className="segmented">
      <motion.div
        layout
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="segmented__thumb"
      />
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`segmented__btn ${value === opt.key ? "is-active" : ""}`}
          type="button"
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/users`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Ошибка загрузки пользователей:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="empty">Загрузка...</div>;
  }

  if (users.length === 0) {
    return <div className="empty">Нет пользователей</div>;
  }

  return (
    <div className="vstack-12">
      {users.map((u) => (
        <div key={u.id} className="card">
          <div className="card__col">
            <div className="text-name">{u.username}</div>
            <div className="text-sub">ID: {u.id}</div>
          </div>
          <div className="hstack-8">
            <span className="tag">{u.status}</span>
            <ChevronRight size={20} color="#cbd5e1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ObjectsTab() {
  return (
    <div className="grid-2-12">
      {demoObjects.map((o) => (
        <div key={o.id} className="tile">
          <div className="tile__body">
            <div className="tile__title">{o.title}</div>
            <div className="tile__sub">{o.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BottomNav({ current, onChange }) {
  const items = [
    { key: "manage", label: "Управление", icon: <Home size={20} /> },
    { key: "calendar", label: "Календарь", icon: <CalendarDays size={20} /> },
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

function EmptyScreen({ title, note }) {
  return (
    <div className="empty">
      <div>
        <div className="empty__title">{title}</div>
        <div className="empty__note">{note || "Здесь будет ваш контент."}</div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [page, setPage] = useState("manage");
  const [section, setSection] = useState("users");

  const renderContent = () => {
    if (page === "manage") {
      return (
        <>
          <div className="mt-12">
            <SegmentedToggle value={section} onChange={setSection} />
          </div>
          <div className="mt-14">
            <AnimatePresence mode="wait">
              {section === "users" ? (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <UsersTab />
                </motion.div>
              ) : (
                <motion.div
                  key="objects"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <ObjectsTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      );
    }
    if (page === "calendar") {
      return <EmptyScreen title="Календарь" note="Пока пусто — добавим расписание/бронь позже." />;
    }
    return <EmptyScreen title="Профиль" note="Здесь появится профиль администратора/пользователя." />;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="title">Управление</div>
      </header>

      <main className="container">{renderContent()}</main>

      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
