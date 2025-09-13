import React, { useMemo, useState, useEffect } from "react";
import {
  Home,
  Users,
  CalendarDays,
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
  const [users, setUsers] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [savingId, setSavingId] = useState(null);

  const STATUS_LABELS = { lead: "Лид", owner: "Владелец", client: "Клиент" };
  const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

  useEffect(() => {
    fetch(`${API}/api/users`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setState({ loading: false, error: "" });
      })
      .catch((err) => {
        console.error("Error fetching users:", err);
        setState({ loading: false, error: err.message || "DB error" });
      });
  }, []);

  const updateStatus = async (user, nextStatus) => {
    if (!user.id) return;

    const prev = users.slice();
    setSavingId(user.id);
    setUsers((arr) =>
      arr.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );

    try {
      const res = await fetch(`${API}/api/users/${user.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to update status:", e);
      setUsers(prev);
      alert("Не удалось изменить статус");
    } finally {
      setSavingId(null);
    }
  };

  if (state.loading) return <div className="empty">Загрузка...</div>;
  if (state.error) return <div className="empty">Ошибка: {state.error}</div>;
  if (!users.length) return <div className="empty">Нет пользователей</div>;

  return (
    <div className="vstack-12">
      {users.map((u) => (
        <div key={u.id} className="card">
          <div className="card__col">
            <div className="text-name">{u.full_name || "Без имени"}</div>
            {u.phone ? <div className="text-sub">{u.phone}</div> : null}
          </div>

          <div className="hstack-8">
            <select
              className="select-pill"
              value={STATUS_OPTIONS.includes(u.status) ? u.status : ""}
              onChange={(e) => updateStatus(u, e.target.value)}
              disabled={savingId === u.id}
            >
              <option value="" disabled>
                Выбрать статус
              </option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Objects Tab -------------------- */
function ObjectsTab() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((data) => setObjects(Array.isArray(data) ? data : []))
      .catch((e) => console.error("objects load error:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Загрузка…</div>;
  if (!objects.length) return <div className="empty">Объектов пока нет</div>;

  return (
    <div className="grid-2-12">
      {objects.map((o) => (
        <div key={o.id} className="tile">
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
            {o.owner_name ? (
              <div className="tile__sub">Владелец: {o.owner_name}</div>
            ) : null}
            {o.owner_contact ? (
              <div className="tile__sub">Контакт: {o.owner_contact}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
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
            <div className="text-name">{b.user_name || "Пользователь"}</div>
            <div className="text-sub">{b.object_title || "Объект"}</div>
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
    { key: "bookings", label: "Бронирования", icon: <ClipboardList size={20} /> },
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
              ) : (
                <motion.div key="objects" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <ObjectsTab />
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
    if (page === "bookings") {
      return <BookingsTab />;
    }
    return null;
  };

  return (
    <div className="app">
      <main className="container">{renderContent()}</main>
      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
