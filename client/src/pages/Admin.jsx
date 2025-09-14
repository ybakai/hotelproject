// Admin.jsx
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
    fetch(`${API}/api/users`)
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
              value={STATUS_OPTIONS.includes(String(u.status)) ? u.status : ""}
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
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [files, setFiles] = useState([]);

  const loadObjects = () => {
    setLoading(true);
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((data) => setObjects(Array.isArray(data) ? data : []))
      .catch((e) => console.error("objects load error:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadObjects();
  }, []);

  const onSelectFiles = (e) => {
    setFiles(Array.from(e.target.files || []).slice(0, 6));
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOwnerId("");
    setOwnerName("");
    setOwnerContact("");
    setFiles([]);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert("Введите название объекта");

    const fd = new FormData();
    fd.append("title", title.trim());
    if (description.trim()) fd.append("description", description.trim());
    if (ownerId) fd.append("owner_id", ownerId);
    if (ownerName.trim()) fd.append("owner_name", ownerName.trim());
    if (ownerContact.trim()) fd.append("owner_contact", ownerContact.trim());
    for (const f of files) fd.append("images", f);

    try {
      const res = await fetch(`${API}/api/objects`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setObjects((prev) => [created, ...prev]);
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Create object failed:", err);
      alert("Не удалось создать объект");
    }
  };

  return (
    <div>
      <div className="objects-toolbar">
        <div className="objects-title">Объекты</div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setShowModal(true)}
        >
          Добавить объект
        </button>
      </div>

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : objects.length === 0 ? (
        <div className="empty">Объектов пока нет</div>
      ) : (
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
      )}

      {showModal && (
        <div className="modal__backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Новый объект</div>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="form" onSubmit={onCreate}>
              <label className="form__group">
                <span className="form__label">Название *</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>

              <label className="form__group">
                <span className="form__label">Описание</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Имя владельца</span>
                <input
                  className="input"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Контакт</span>
                <input
                  className="input"
                  value={ownerContact}
                  onChange={(e) => setOwnerContact(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">ID владельца</span>
                <input
                  className="input"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Картинки (до 6)</span>
                <input
                  className="input"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={onSelectFiles}
                />
              </label>

              {files.length > 0 && (
                <div className="previews">
                  {files.map((f, i) => (
                    <div key={i} className="preview">
                      <img src={URL.createObjectURL(f)} alt={f.name} />
                    </div>
                  ))}
                </div>
              )}

              <div className="form__actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  Отмена
                </button>
                <button className="btn-primary" type="submit">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Bookings Tab -------------------- */
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU");
}
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
        <div key={b.id} className="booking-card">
          <div className="booking-header">
            {b.user_name || "Пользователь"} {b.user_phone ? `(${b.user_phone})` : ""}
          </div>
          <div className="booking-sub">🏠 {b.object_title}</div>
          <div className="booking-sub">
            📅 {formatDate(b.start_date)} → {formatDate(b.end_date)}
          </div>
          <div className={`booking-status ${b.status}`}>{b.status}</div>
          {b.status === "pending" && (
            <div className="booking-actions">
              <button className="btn-primary" onClick={() => updateStatus(b.id, "confirmed")}>
                Подтвердить
              </button>
              <button className="btn-secondary" onClick={() => updateStatus(b.id, "rejected")}>
                Отклонить
              </button>
            </div>
          )}
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
  const [range, setRange] = useState();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/bookings`)
      .then((r) => r.json())
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch((e) => console.error("calendar bookings load error:", e));
  }, []);

  const bookedRanges = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => ({ start: b.start_date, end: b.end_date }));

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
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <UsersTab />
                </motion.div>
              ) : (
                <motion.div key="objects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
          <AdminCalendar
            months={1}
            bookedRanges={bookedRanges}
            selected={range}
            onSelectRange={setRange}
            readOnly={true}
          />
        </div>
      );
    }
    if (page === "bookings") return <BookingsTab />;
    return null;
  };

  return (
    <div className="app">
      <main className="container">{renderContent()}</main>
      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}
