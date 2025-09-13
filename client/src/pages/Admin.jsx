import React, { useMemo, useState, useEffect } from "react";
import {
  Home,
  Users,
  CalendarDays,
  UserCircle2,
  Building2,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";

const API = "https://hotelproject-8cip.onrender.com";

/* -------------------- Segmented Toggle -------------------- */
function SegmentedToggle({ value, onChange }) {
  const options = useMemo(
    () => [
      { key: "users", label: "Пользователи", icon: <Users size={16} /> },
      { key: "objects", label: "Объекты", icon: <Building2 size={16} /> },
      { key: "bookings", label: "Брони", icon: <ClipboardList size={16} /> },
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

/* -------------------- Users Tab -------------------- */
function UsersTab() {
  // … твой код без изменений …
}

/* -------------------- Objects Tab -------------------- */
function ObjectsTab() {
  // … твой код без изменений …
}

/* -------------------- Bookings Tab -------------------- */
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/bookings`);
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Ошибка загрузки броней:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function updateStatus(id, status) {
    try {
      const res = await fetch(`${API}/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadBookings();
    } catch (err) {
      alert("Ошибка изменения статуса: " + err.message);
    }
  }

  if (loading) return <div className="empty">Загрузка…</div>;
  if (!bookings.length) return <div className="empty">Броней пока нет</div>;

  return (
    <div className="vstack-12">
      {bookings.map((b) => (
        <div key={b.id} className="card">
          <div className="card__col">
            <div className="text-name">{b.user_name || "Без имени"}</div>
            <div className="text-sub">{b.object_title || "Без объекта"}</div>
            <div className="text-sub">
              {b.start_date} → {b.end_date}
            </div>
            <div className="text-sub">Статус: {b.status}</div>
          </div>
          <div className="hstack-8">
            {b.status === "pending" && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => updateStatus(b.id, "confirmed")}
                >
                  ✅ Подтвердить
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => updateStatus(b.id, "rejected")}
                >
                  ❌ Отклонить
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Bottom Nav -------------------- */
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

/* -------------------- Empty Screen -------------------- */
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

/* -------------------- Admin Page -------------------- */
export default function Admin() {
  const [page, setPage] = useState("manage");
  const [section, setSection] = useState("users");
  const [range, setRange] = React.useState();

  const bookedRanges = [
    { start: "2025-08-12", end: "2025-08-15" },
    { start: "2025-08-20", end: "2025-08-23" },
  ];

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
                <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <UsersTab />
                </motion.div>
              ) : section === "objects" ? (
                <motion.div key="objects" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <ObjectsTab />
                </motion.div>
              ) : (
                <motion.div key="bookings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <BookingsTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      );
    }
    if (page === "calendar") {
      return (
        <div style={{ padding: 20 }}>
          <AdminCalendar months={1} bookedRanges={bookedRanges} selected={range} onSelectRange={setRange} readOnly={false} />
        </div>
      );
    }
    return <EmptyScreen title="Профиль" note="Здесь появится профиль администратора/пользователя." />;
  };

  return (
    <div className="app">
      <main className="container">{renderContent()}</main>
      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
