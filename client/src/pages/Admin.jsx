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

/* -------------------- Objects Tab (создание + редактирование) -------------------- */
function ObjectsTab() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // создание
  const [showCreate, setShowCreate] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cOwnerId, setCOwnerId] = useState("");
  const [cOwnerName, setCOwnerName] = useState("");
  const [cOwnerContact, setCOwnerContact] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cArea, setCArea] = useState("");   // оставляем строкой
  const [cRooms, setCRooms] = useState(""); // строкой
  const [cShare, setCShare] = useState("");
  const [cFiles, setCFiles] = useState([]); // File[]

  // редактирование
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [eTitle, setETitle] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eOwnerId, setEOwnerId] = useState("");
  const [eOwnerName, setEOwnerName] = useState("");
  const [eOwnerContact, setEOwnerContact] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eArea, setEArea] = useState("");
  const [eRooms, setERooms] = useState("");
  const [eShare, setEShare] = useState("");
  const [eFiles, setEFiles] = useState([]); // новые картинки (опционально)
  const [eImages, setEImages] = useState([]); // существующие ссылки (read-only превью)

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

  /* ---- helpers for create ---- */
  const onSelectCreateFiles = (e) => {
    setCFiles(Array.from(e.target.files || []).slice(0, 6));
  };

  const resetCreateForm = () => {
    setCTitle("");
    setCDescription("");
    setCOwnerId("");
    setCOwnerName("");
    setCOwnerContact("");
    setCAddress("");
    setCArea("");
    setCRooms("");
    setCShare("");
    setCFiles([]);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!cTitle.trim()) return alert("Введите название объекта");

    const fd = new FormData();
    fd.append("title", cTitle.trim());
    if (cDescription.trim()) fd.append("description", cDescription.trim());
    if (cOwnerId) fd.append("owner_id", cOwnerId);
    if (cOwnerName.trim()) fd.append("owner_name", cOwnerName.trim());
    if (cOwnerContact.trim()) fd.append("owner_contact", cOwnerContact.trim());
    if (cAddress.trim()) fd.append("address", cAddress.trim());
    if (String(cArea).trim() !== "") fd.append("area", cArea);
    if (String(cRooms).trim() !== "") fd.append("rooms", cRooms);
    if (cShare.trim()) fd.append("share", cShare.trim());
    for (const f of cFiles) fd.append("images", f);

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
      setShowCreate(false);
      resetCreateForm();
    } catch (err) {
      console.error("Create object failed:", err);
      alert("Не удалось создать объект");
    }
  };

  /* ---- helpers for edit ---- */
  const openEdit = (obj) => {
    setEditingId(obj.id);
    setETitle(obj.title || "");
    setEDescription(obj.description || "");
    setEOwnerId(obj.owner_id || "");
    setEOwnerName(obj.owner_name || "");
    setEOwnerContact(obj.owner_contact || "");
    setEAddress(obj.address || "");
    setEArea(obj.area ?? "");     // число/null -> строка
    setERooms(obj.rooms ?? "");
    setEShare(obj.share || "");
    setEFiles([]);
    setEImages(Array.isArray(obj.images) ? obj.images : []);
    setShowEdit(true);
  };

  const onSelectEditFiles = (e) => {
    setEFiles(Array.from(e.target.files || []).slice(0, 6));
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    const fd = new FormData();
    fd.append("title", eTitle.trim());
    if (eDescription?.trim()) fd.append("description", eDescription.trim());
    if (eOwnerId) fd.append("owner_id", eOwnerId);
    if (eOwnerName?.trim()) fd.append("owner_name", eOwnerName.trim());
    if (eOwnerContact?.trim()) fd.append("owner_contact", eOwnerContact.trim());
    if (eAddress?.trim()) fd.append("address", eAddress.trim());
    if (String(eArea).trim() !== "") fd.append("area", eArea);
    if (String(eRooms).trim() !== "") fd.append("rooms", eRooms);
    if (eShare?.trim()) fd.append("share", eShare.trim());
    // добавляем НОВЫЕ картинки (если выбраны)
    for (const f of eFiles) fd.append("images", f);

    try {
      const res = await fetch(`${API}/api/objects/${editingId}`, {
        method: "PATCH",
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setObjects((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it))
      );
      setShowEdit(false);
      setEditingId(null);
    } catch (err) {
      console.error("Update object failed:", err);
      alert("Не удалось обновить объект");
    }
  };

  if (loading) return <div className="empty">Загрузка…</div>;

  return (
    <div>
      {/* панель сверху */}
      <div className="objects-toolbar">
        <div className="objects-title">Объекты</div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setShowCreate(true)}
        >
          Добавить объект
        </button>
      </div>

      {/* список / пусто */}
      {objects.length === 0 ? (
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

                <div className="hstack-8" style={{ marginTop: 8 }}>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => openEdit(o)}
                  >
                    Редактировать
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- модалка СОЗДАНИЯ ---- */}
      {showCreate && (
        <div className="modal__backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Новый объект</div>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>

            <form className="form" onSubmit={onCreate}>
              <label className="form__group">
                <span className="form__label">Название *</span>
                <input
                  className="input"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  placeholder="Напр. Villa Fir"
                  required
                />
              </label>

              <label className="form__group">
                <span className="form__label">Описание</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={cDescription}
                  onChange={(e) => setCDescription(e.target.value)}
                  placeholder="Краткое описание"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Имя владельца</span>
                <input
                  className="input"
                  value={cOwnerName}
                  onChange={(e) => setCOwnerName(e.target.value)}
                  placeholder="Напр. Иван Иванов"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Контакт (телефон/email)</span>
                <input
                  className="input"
                  value={cOwnerContact}
                  onChange={(e) => setCOwnerContact(e.target.value)}
                  placeholder="+380 67 123 4567 или email"
                />
              </label>

              <label className="form__group">
                <span className="form__label">ID владельца (опционально)</span>
                <input
                  className="input"
                  value={cOwnerId}
                  onChange={(e) => setCOwnerId(e.target.value)}
                  placeholder="id пользователя"
                  inputMode="numeric"
                />
              </label>

              {/* новые поля */}
              <label className="form__group">
                <span className="form__label">Адрес</span>
                <input
                  className="input"
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  placeholder="Город, улица, дом/квартал"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Площадь (м²)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={cArea}
                  onChange={(e) => setCArea(e.target.value)}
                  placeholder="Напр. 75.5"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Комнаты</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={cRooms}
                  onChange={(e) => setCRooms(e.target.value)}
                  placeholder="Напр. 3"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Доля</span>
                <input
                  className="input"
                  value={cShare}
                  onChange={(e) => setCShare(e.target.value)}
                  placeholder="Напр. 1/2 или 50%"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Картинки (до 6)</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onSelectCreateFiles}
                />
              </label>

              {cFiles.length > 0 && (
                <div className="previews">
                  {cFiles.map((f, i) => (
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
                  onClick={() => setShowCreate(false)}
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

      {/* ---- модалка РЕДАКТИРОВАНИЯ ---- */}
      {showEdit && (
        <div className="modal__backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Редактирование объекта</div>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowEdit(false)}
              >
                ✕
              </button>
            </div>

            <form className="form" onSubmit={onUpdate}>
              <label className="form__group">
                <span className="form__label">Название *</span>
                <input
                  className="input"
                  value={eTitle}
                  onChange={(e) => setETitle(e.target.value)}
                  required
                />
              </label>

              <label className="form__group">
                <span className="form__label">Описание</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={eDescription}
                  onChange={(e) => setEDescription(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Имя владельца</span>
                <input
                  className="input"
                  value={eOwnerName}
                  onChange={(e) => setEOwnerName(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Контакт (телефон/email)</span>
                <input
                  className="input"
                  value={eOwnerContact}
                  onChange={(e) => setEOwnerContact(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">ID владельца (опционально)</span>
                <input
                  className="input"
                  value={eOwnerId}
                  onChange={(e) => setEOwnerId(e.target.value)}
                  inputMode="numeric"
                />
              </label>

              {/* новые поля */}
              <label className="form__group">
                <span className="form__label">Адрес</span>
                <input
                  className="input"
                  value={eAddress}
                  onChange={(e) => setEAddress(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Площадь (м²)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={eArea}
                  onChange={(e) => setEArea(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Комнаты</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={eRooms}
                  onChange={(e) => setERooms(e.target.value)}
                />
              </label>

              <label className="form__group">
                <span className="form__label">Доля</span>
                <input
                  className="input"
                  value={eShare}
                  onChange={(e) => setEShare(e.target.value)}
                />
              </label>

              {/* Превью текущих изображений (если есть) */}
              {eImages?.length > 0 && (
                <div className="form__group">
                  <span className="form__label">Текущие изображения</span>
                  <div className="previews">
                    {eImages.map((url, i) => (
                      <div key={i} className="preview">
                        <img src={url} alt={`img-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="form__group">
                <span className="form__label">Добавить новые картинки</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onSelectEditFiles}
                />
              </label>

              {eFiles.length > 0 && (
                <div className="previews">
                  {eFiles.map((f, i) => (
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
                  onClick={() => setShowEdit(false)}
                >
                  Отмена
                </button>
                <button className="btn-primary" type="submit">
                  Сохранить
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
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function BookingsTab({ bookings, reload, updateStatus }) {
  async function changeStatus(id, status) {
    try {
      await updateStatus(id, status);
      await reload();
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  }

  async function deleteBooking(id) {
    if (!id) return;
    if (!confirm("Точно отменить и удалить эту бронь?")) return;
    try {
      const res = await fetch(`${API}/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      await reload();
    } catch (err) {
      console.error("delete booking error:", err);
      alert("Не удалось удалить бронь");
    }
  }

  if (!bookings.length) return <div className="empty">Броней пока нет</div>;

  return (
    <div className="vstack-12">
      {bookings.map((b) => (
        <div key={b.id} className="booking-card">
          <div className="booking-header">
            {b.user_name || "Пользователь"} {b.user_phone ? `(${b.user_phone})` : ""}
          </div>
          <div className="booking-sub">🏠 {b.object_title || "Объект"}</div>
          <div className="booking-sub">📅 {formatDate(b.start_date)} → {formatDate(b.end_date)}</div>

          <div className={`booking-status ${b.status}`}>
            {b.status === "pending"
              ? "⏳ Ожидает"
              : b.status === "confirmed"
              ? "✅ Подтверждено"
              : b.status === "cancelled"
              ? "🚫 Отменена"
              : "❌ Отклонено"}
          </div>

          {b.status === "pending" && (
            <div className="booking-actions">
              <button className="btn-primary" onClick={() => changeStatus(b.id, "confirmed")}>
                Подтвердить
              </button>
              <button className="btn-secondary" onClick={() => changeStatus(b.id, "rejected")}>
                Отклонить
              </button>
            </div>
          )}

          <div className="booking-actions" style={{ marginTop: 8 }}>
            <button
              className="btn-secondary"
              onClick={() => deleteBooking(b.id)}
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              Отменить (удалить)
            </button>
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
  const [range, setRange] = useState();
  const [bookings, setBookings] = useState([]);

  async function loadBookings() {
    try {
      const res = await fetch(`${API}/api/bookings`);
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Ошибка загрузки броней:", err);
    }
  }

  async function updateStatus(id, status) {
    const res = await fetch(`${API}/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const confirmedRanges = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => ({
      start: b.start_date.split("T")[0],
      end: b.end_date.split("T")[0],
    }));

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
                >
                  <UsersTab />
                </motion.div>
              ) : (
                <motion.div
                  key="objects"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
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
      return (
        <div style={{ padding: 20 }}>
          <AdminCalendar
            months={1}
            bookedRanges={confirmedRanges}
            selected={range}
            onSelectRange={setRange}
            readOnly={true}
          />
        </div>
      );
    }
    if (page === "bookings") {
      return (
        <BookingsTab
          bookings={bookings}
          reload={loadBookings}
          updateStatus={updateStatus}
        />
      );
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
