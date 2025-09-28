import React, { useMemo, useState, useEffect } from "react";
import {
  Home,
  Users,
  CalendarDays,
  Building2,
  ClipboardList,
  Shuffle,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Admin.css";
import AdminCalendar from "/src/components/calendarAdmin/CalendarAdmin.jsx";

// через Vercel-прокси
const API = "";

/* -------------------- helpers -------------------- */
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const toYMD = (dLike) => {
  const d = dLike instanceof Date ? dLike : new Date(dLike);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// --- email helpers ---
const CYR_TO_LAT = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};
function translit(str = "") {
  return str
    .toLowerCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join("");
}
function slugLocalPart(s = "") {
  // убираем лишнее, оставляем латиницу/цифры/._-
  const base = translit(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
  // ограничим длину локальной части (RFC — 64 символа)
  return (base || "user").slice(0, 64);
}
function makeEmailLogin(name, phoneDigits) {
  // приоритет: телефон -> имя -> fallback
  if (phoneDigits) {
    const local = `tel${phoneDigits}`.slice(0, 64);
    return `${local}@byhan.com`;
  }
  if (name?.trim()) {
    const local = slugLocalPart(name.trim());
    return `${local}@byhan.com`;
  }
  return `user${Date.now()}@byhan.com`;
}

const overlaps = (aStart, aEnd, bStart, bEnd) => {
  return !(
    new Date(aEnd) < new Date(bStart) || new Date(bEnd) < new Date(aStart)
  );
};

const toDateOnly = (dLike) => {
  const d = dLike instanceof Date ? dLike : new Date(dLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const nightsBetween = (startIso, endIso) => {
  const ms = toDateOnly(endIso) - toDateOnly(startIso);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
};

const colorFromId = (id) => {
  const n = Number(id) || 0;
  const hue = (n * 47) % 360;
  return `hsl(${hue} 70% 45%)`;
};

/* -------- телефон: маска и утилиты -------- */
function formatPhoneMask(value) {
  const d = value.replace(/\D/g, "").slice(0, 15);
  if (!d) return "";
  let res = "+" + d[0];
  if (d.length > 1) res += " " + d.slice(1, 4);
  if (d.length > 4) res += " " + d.slice(4, 7);
  if (d.length > 7) res += "-" + d.slice(7, 9);
  if (d.length > 9) res += "-" + d.slice(9, 11);
  if (d.length > 11) res += " " + d.slice(11);
  return res;
}
const phoneDigitsOnly = (v) => v.replace(/\D/g, "");

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
/* -------------------- Users Tab -------------------- */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [savingId, setSavingId] = useState(null);

  // NEW: add-user modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addObjectId, setAddObjectId] = useState("");
  const [allObjects, setAllObjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [issuedCreds, setIssuedCreds] = useState(null); // {email,password}

  // NEW: credentials viewer
  const [showCreds, setShowCreds] = useState(false);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsUser, setCredsUser] = useState(null);
  const [creds, setCreds] = useState(null);

  const STATUS_LABELS = { lead: "Лид", owner: "Владелец", client: "Клиент" };
  const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

  const phoneDigits = useMemo(() => phoneDigitsOnly(addPhone), [addPhone]);

  const genPassword = (len = 10) => {
    const abc =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let s = "";
    for (let i = 0; i < len; i++)
      s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  };

  const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

  const loadUsers = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // подгружаем объекты когда открываем модалку
  useEffect(() => {
    if (!showAdd) return;
    fetch(`${API}/api/objects`)
      .then((r) => r.json())
      .then((d) => setAllObjects(Array.isArray(d) ? d : []))
      .catch((e) => console.error("objects load error:", e));
  }, [showAdd]);

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

  // NEW: удалить пользователя
  async function deleteUser(id) {
    if (!id) return;
    if (!confirm("Удалить пользователя безвозвратно?")) return;
    try {
      const res = await fetch(`${API}/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      setUsers((arr) => arr.filter((u) => u.id !== id));
    } catch (e) {
      console.error("delete user error:", e);
      alert(
        "Не удалось удалить пользователя (возможно, есть связанные данные)"
      );
    }
  }

  // NEW: открыть модалку с логином/паролем
  async function openCredentials(u) {
    if (!u?.id) return;
    setCredsUser(u);
    setShowCreds(true);
    setCreds(null);
    setCredsLoading(true);
    try {
      const r = await fetch(`${API}/api/users/${u.id}/credentials`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "server error");
      setCreds(d); // { ok, email, password }
    } catch (e) {
      alert("Не удалось загрузить учётные данные: " + (e.message || "error"));
      setShowCreds(false);
    } finally {
      setCredsLoading(false);
    }
  }

  // NEW: создать пользователя и привязать объект
  async function onCreateUser(e) {
    e?.preventDefault?.();
    if (!addName.trim() && !addPhone.trim()) {
      alert("Укажите хотя бы имя или телефон");
      return;
    }
    setCreating(true);
    setIssuedCreds(null);

    const email = phoneDigits
      ? `tel${phoneDigits}@byhan.com`
      : `user${Date.now()}@byhan.com`;
    const password = genPassword();

    try {
      // 1) создаём пользователя админски через /auth/register
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: addName.trim() || null,
          phone: addPhone.trim() || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "register failed");

      const created = data?.user;
      if (!created?.id) throw new Error("user create: invalid response");

      // 2) если выбран объект — назначаем владельца объекту
      if (addObjectId) {
        const fd = new FormData();
        fd.append("owner_id", String(created.id));
        if (addName.trim()) fd.append("owner_name", addName.trim());
        if (addPhone.trim()) fd.append("owner_contact", addPhone.trim());
        const rp = await fetch(`${API}/api/objects/${addObjectId}`, {
          method: "PATCH",
          body: fd,
        });
        if (!rp.ok) {
          const t = await rp.text();
          throw new Error(t || "bind object failed");
        }
      }

      // 3) показать выданные креды и обновить список
      setIssuedCreds({ email, password });
      loadUsers();

      // сброс полей формы (оставим объект выбранным)
      setAddName("");
      setAddPhone("");
    } catch (e) {
      console.error(e);
      alert("Не удалось создать пользователя: " + (e.message || "error"));
    } finally {
      setCreating(false);
    }
  }

  const handleAddPhoneChange = (e) => {
    const v = e.target.value;
    if (/^[+\d\s\-()]*$/.test(v)) setAddPhone(formatPhoneMask(v));
    else setAddPhone(v);
  };

  if (state.loading) return <div className="empty">Загрузка...</div>;
  if (state.error) return <div className="empty">Ошибка: {state.error}</div>;
  // список может быть пустым — ок

  return (
    <div className="vstack-12">
      {/* NEW: панель действий */}
      <div className="objects-toolbar" style={{ marginBottom: 8 }}>
        <div className="objects-title">Пользователи</div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setShowAdd(true)}
        >
          Добавить пользователя
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty">Нет пользователей</div>
      ) : (
        users.map((u) => (
          <div key={u.id} className="card">
            <div
              className="card__col"
              onClick={() => openCredentials(u)}
              style={{ cursor: "pointer" }}
              title="Показать логин/пароль"
            >
              <div className="text-name">{u.full_name || "Без имени"}</div>
              {u.phone ? <div className="text-sub">{u.phone}</div> : null}
            </div>

            <div className="hstack-8">
              <select
                className="select-pill"
                value={
                  STATUS_OPTIONS.includes(String(u.status)) ? u.status : ""
                }
                onChange={(e) => updateStatus(u, e.target.value)}
                disabled={savingId === u.id}
                title="Статус"
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

              {/* NEW: удалить */}
              <button
                className="btn-secondary"
                type="button"
                onClick={() => deleteUser(u.id)}
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderColor: "#fecaca",
                }}
                title="X"
              >
                X
              </button>
            </div>
          </div>
        ))
      )}

      {/* NEW: модалка добавления пользователя */}
      {showAdd && (
        <div className="modal__backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Добавить пользователя</div>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowAdd(false)}
              >
                ✕
              </button>
            </div>

            <form className="form" onSubmit={onCreateUser}>
              <label className="form__group">
                <span className="form__label">Имя</span>
                <input
                  className="input"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Иван Иванов"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Телефон</span>
                <input
                  className="input"
                  value={addPhone}
                  onChange={handleAddPhoneChange}
                  placeholder="+7 900 000-00-00"
                />
              </label>

              <label className="form__group">
                <span className="form__label">Привязать к объекту</span>
                <select
                  className="input"
                  value={addObjectId}
                  onChange={(e) => setAddObjectId(e.target.value)}
                >
                  <option value="">— не выбирать —</option>
                  {allObjects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title || `Объект #${o.id}`}
                      {o.owner_id ? " (занят)" : ""}
                    </option>
                  ))}
                </select>
                <small className="form__hint">
                  Будет назначен владельцем выбранного объекта.
                </small>
              </label>

              {/* выданные креды (аккуратно оформлено) */}
              {issuedCreds && (
                <div
                  className="card"
                  style={{ background: "#f9fafb", marginTop: 10 }}
                >
                  <div className="text-sub" style={{ marginBottom: 6 }}>
                    Данные для входа (передайте пользователю):
                  </div>

                  <div
                    style={{
                      display: "grid",
                      rowGap: 6,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    <div>
                      <span style={{ color: "#6b7280" }}>Логин (email):</span>
                      <br />
                      <code
                        style={{
                          background: "#eef2ff",
                          padding: "2px 6px",
                          borderRadius: 6,
                          display: "inline-block",
                        }}
                      >
                        {issuedCreds.email}
                      </code>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Пароль:</span>
                      <br />
                      <code
                        style={{
                          background: "#eef2ff",
                          padding: "2px 6px",
                          borderRadius: 6,
                          display: "inline-block",
                        }}
                      >
                        {issuedCreds.password}
                      </code>
                    </div>
                  </div>

                  <div className="hstack-8" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        copy(`${issuedCreds.email} ${issuedCreds.password}`)
                      }
                    >
                      Скопировать
                    </button>
                  </div>
                </div>
              )}

              <div className="form__actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowAdd(false)}
                >
                  Отмена
                </button>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={creating}
                >
                  {creating ? "Создаём…" : "Зарегистрировать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW: модалка учётных данных пользователя */}
      {showCreds && (
        <div className="modal__backdrop" onClick={() => setShowCreds(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">
                Учётные данные{" "}
                {credsUser?.full_name ? `— ${credsUser.full_name}` : ""}
              </div>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowCreds(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal__body">
              {credsLoading ? (
                <div className="empty">Загрузка…</div>
              ) : !creds ? (
                <div className="empty">Не удалось получить данные</div>
              ) : (
                <div className="vstack-12">
                  <div style={{ display: "grid", rowGap: 10 }}>
                    <div>
                      <div className="text-sub" style={{ marginBottom: 4 }}>
                        Логин (email)
                      </div>
                      <code
                        style={{
                          background: "#eef2ff",
                          padding: "4px 8px",
                          borderRadius: 6,
                          display: "inline-block",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                      >
                        {creds.email}
                      </code>
                    </div>
                    <div>
                      <div className="text-sub" style={{ marginBottom: 4 }}>
                        Пароль
                      </div>
                      <code
                        style={{
                          background: "#eef2ff",
                          padding: "4px 8px",
                          borderRadius: 6,
                          display: "inline-block",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                      >
                        {creds.password}
                      </code>
                    </div>
                  </div>

                  <div className="hstack-8">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => copy(`${creds.email} ${creds.password}`)}
                    >
                      Скопировать
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Objects Tab -------------------- */
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
  const [cArea, setCArea] = useState("");
  const [cRooms, setCRooms] = useState("");
  const [cShare, setCShare] = useState("");
  const [cFiles, setCFiles] = useState([]);

  // валидация телефона (create)
  const cOwnerContactDigits = useMemo(
    () => phoneDigitsOnly(cOwnerContact),
    [cOwnerContact]
  );
  const cOwnerContactValid = useMemo(
    () => !cOwnerContact || cOwnerContactDigits.length >= 10,
    [cOwnerContact, cOwnerContactDigits]
  );
  const handleCreateContactChange = (e) => {
    const v = e.target.value;
    if (/^[+\d\s\-()]*$/.test(v)) {
      setCOwnerContact(formatPhoneMask(v));
    } else {
      setCOwnerContact(v);
    }
  };

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
  const [eFiles, setEFiles] = useState([]);
  const [eImages, setEImages] = useState([]);

  // валидация телефона (edit)
  const eOwnerContactDigits = useMemo(
    () => phoneDigitsOnly(eOwnerContact),
    [eOwnerContact]
  );
  const eOwnerContactValid = useMemo(
    () => !eOwnerContact || eOwnerContactDigits.length >= 10,
    [eOwnerContact, eOwnerContactDigits]
  );
  const handleEditContactChange = (e) => {
    const v = e.target.value;
    if (/^[+\d\s\-()]*$/.test(v)) {
      setEOwnerContact(formatPhoneMask(v));
    } else {
      setEOwnerContact(v);
    }
  };

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

    if (/[+\d]/.test(cOwnerContact) && !cOwnerContactValid) {
      return alert("Укажите корректный телефон владельца (минимум 10 цифр)");
    }

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

  const openEdit = (obj) => {
    setEditingId(obj.id);
    setETitle(obj.title || "");
    setEDescription(obj.description || "");
    setEOwnerId(obj.owner_id || "");
    setEOwnerName(obj.owner_name || "");
    setEOwnerContact(obj.owner_contact || "");
    setEAddress(obj.address || "");
    setEArea(obj.area ?? "");
    setERooms(obj.rooms ?? "");
    setEShare(obj.share || "");
    setEFiles([]);
    setEImages(Array.isArray(obj.images) ? obj.images : []);
    setShowEdit(true);
  };

  const onSelectEditFiles = (e) => {
    setEFiles(Array.from(e.target.files || []).slice(0, 6));
  };

  const onDelete = async () => {
    if (!editingId) return;
    if (!confirm("Точно удалить объект? Это действие необратимо.")) return;
    try {
      const res = await fetch(`${API}/api/objects/${editingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      setObjects((prev) => prev.filter((o) => o.id !== editingId));
      setShowEdit(false);
      setEditingId(null);
    } catch (err) {
      console.error("Delete object failed:", err);
      alert("Не удалось удалить объект");
    }
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    if (/[+\d]/.test(eOwnerContact) && !eOwnerContactValid) {
      return alert("Укажите корректный телефон владельца (минимум 10 цифр)");
    }

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
                <div className="tile__imgwrap tile__imgwrap--empty">
                  Нет фото
                </div>
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

      {/* модалка создания */}
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
                  className={`input ${
                    cOwnerContact && !cOwnerContactValid ? "is-error" : ""
                  }`}
                  value={cOwnerContact}
                  onChange={handleCreateContactChange}
                  placeholder="+48 600 000-000 или email"
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

      {/* модалка редактирования */}
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
                  className={`input ${
                    eOwnerContact && !eOwnerContactValid ? "is-error" : ""
                  }`}
                  value={eOwnerContact}
                  onChange={handleEditContactChange}
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

              {eAddress !== undefined && (
                <label className="form__group">
                  <span className="form__label">Адрес</span>
                  <input
                    className="input"
                    value={eAddress}
                    onChange={(e) => setEAddress(e.target.value)}
                  />
                </label>
              )}

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
              <div
                className="form__actions"
                style={{ justifyContent: "flex-start" }}
              >
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={onDelete}
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderColor: "#fecaca",
                  }}
                >
                  Удалить объект
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
function BookingsTab({ bookings, reloadAll, updateBookingStatus }) {
  async function changeStatus(id, status) {
    try {
      await updateBookingStatus(id, status);
      await reloadAll();
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  }

  async function deleteBooking(id) {
    if (!id) return;
    if (!confirm("Точно отменить и удалить эту бронь?")) return;
    try {
      const res = await fetch(`${API}/api/bookings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      await reloadAll();
    } catch (err) {
      console.error("delete booking error:", err);
      alert("Не удалось удалить бронь");
    }
  }

  const list = [...bookings].sort((a, b) => {
    const ad = a.created_at ? new Date(a.created_at) : new Date(0);
    const bd = b.created_at ? new Date(b.created_at) : new Date(0);
    return bd - ad;
  });

  if (!list.length) return <div className="empty">Пока пусто</div>;

  return (
    <div className="vstack-12">
      {list.map((it) => (
        <div key={`bk-${it.id}`} className="booking-card">
          <div className="booking-header">
            {it.user_name || "Пользователь"}{" "}
            {it.user_phone ? `(${it.user_phone})` : ""}
          </div>
          <div className="booking-sub">🏠 {it.object_title || "Объект"}</div>
          <div className="booking-sub">
            📅 {fmtDate(it.start_date)} → {fmtDate(it.end_date)}
          </div>

          <div className={`booking-status ${it.status}`}>
            {it.status === "pending"
              ? "⏳ Ожидает"
              : it.status === "confirmed"
              ? "✅ Подтверждено"
              : it.status === "cancelled"
              ? "🚫 Отменена"
              : "❌ Отклонено"}
          </div>

          {it.status === "pending" && (
            <div className="booking-actions">
              <button
                className="btn-primary"
                onClick={() => changeStatus(it.id, "confirmed")}
              >
                Подтвердить
              </button>
              <button
                className="btn-secondary"
                onClick={() => changeStatus(it.id, "rejected")}
              >
                Отклонить
              </button>
            </div>
          )}

          <div className="booking-actions" style={{ marginTop: 8 }}>
            <button
              className="btn-secondary"
              onClick={() => deleteBooking(it.id)}
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

/* -------------------- Bottom Nav (с выходом) -------------------- */
function BottomNav({ current, onChange, onLogout }) {
  const items = [
    { key: "manage", label: "Управление", icon: <Home size={20} /> },
    { key: "calendar", label: "Календарь", icon: <CalendarDays size={20} /> },
    {
      key: "bookings",
      label: "Бронирования",
      icon: <ClipboardList size={20} />,
    },
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

          {/* кнопка выхода */}
          <button
            key="logout"
            onClick={onLogout}
            className="bottom__btn"
            type="button"
            title="Выйти"
          >
            <LogOut size={20} />
            <span>Выход</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

/* -------------------- Admin Page -------------------- */
export default function Admin({ user, onLogout }) {
  const [page, setPage] = useState("manage");
  const [section, setSection] = useState("users");
  const [range, setRange] = useState();

  const [bookings, setBookings] = useState([]);
  const [exchanges, setExchanges] = useState([]);

  async function loadBookings() {
    try {
      const res = await fetch(`${API}/api/bookings`);
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Ошибка загрузки броней:", err);
    }
  }

  async function loadExchanges() {
    try {
      const r = await fetch(`${API}/api/exchanges`);
      const d = await r.json();
      setExchanges(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error("Ошибка загрузки обменов:", e);
    }
  }

  async function reloadAll() {
    await Promise.all([loadBookings(), loadExchanges()]);
  }

  async function updateBookingStatus(id, status) {
    const res = await fetch(`${API}/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function decideExchange(id, action) {
    try {
      const r = await fetch(`${API}/api/exchanges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "server error");
      await reloadAll();
      alert(action === "approve" ? "Обмен подтверждён" : "Обмен отклонён");
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

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
      const busyRanges = bookings
        .filter((b) => ["pending", "confirmed"].includes(b.status))
        .map((b) => ({
          start: toYMD(b.start_date),
          end: toYMD(b.end_date),
        }));

      const now = new Date();
      const actual = bookings.filter(
        (b) => toDateOnly(b.end_date) >= toDateOnly(now)
      );

      const list =
        range?.from && range?.to
          ? actual
              .filter((b) => b.status !== "cancelled")
              .filter((b) =>
                overlaps(
                  toYMD(range.from),
                  toYMD(range.to),
                  toYMD(b.start_date),
                  toYMD(b.end_date)
                )
              )
              .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
          : actual
              .filter((b) => b.status === "confirmed")
              .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
              .slice(0, 30);

      return (
        <div style={{ padding: 20 }}>
          <AdminCalendar
            months={1}
            bookedRanges={busyRanges}
            selected={range}
            onSelectRange={setRange}
            readOnly={false}
          />

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={range?.from ? "panel-selected" : "panel-upcoming"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="calendar-panel"
            >
              <div className="panel-header">
                <div className="panel-title">
                  {range?.from && range?.to ? (
                    <>
                      Брони за период: <b>{fmtDate(range.from)}</b> —{" "}
                      <b>{fmtDate(range.to)}</b>
                    </>
                  ) : (
                    <>Ближайшие бронирования</>
                  )}
                </div>
                <div className="panel-actions">
                  {range?.from && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => setRange(undefined)}
                    >
                      Сбросить выбор
                    </button>
                  )}
                  <button
                    className="btn-secondary btn-sm"
                    onClick={reloadAll}
                    title="Обновить"
                  >
                    Обновить
                  </button>
                </div>
              </div>

              {list.length === 0 ? (
                <div className="empty">Нет бронирований для выбранных дат</div>
              ) : (
                <div className="cal-list">
                  {list.map((b) => {
                    const color = colorFromId(b.object_id);
                    const nights = nightsBetween(b.start_date, b.end_date);
                    return (
                      <div
                        key={b.id}
                        className="cal-item"
                        style={{ borderLeftColor: color }}
                      >
                        <div className="cal-item__row">
                          <div
                            className="cal-item__object"
                            title={`Object ID: ${b.object_id}`}
                          >
                            🏠 {b.object_title || "Объект"}
                          </div>
                          <span className={`badge badge--${b.status}`}>
                            {b.status === "pending" && "Ожидает"}
                            {b.status === "confirmed" && "Подтверждено"}
                            {b.status === "rejected" && "Отклонено"}
                            {b.status === "cancelled" && "Отменена"}
                          </span>
                        </div>
                        <div className="cal-item__row">
                          <div className="cal-item__user">
                            👤 {b.user_name || "Пользователь"}
                            {b.user_phone ? ` (${b.user_phone})` : ""}
                          </div>
                          <div className="cal-item__dates">
                            📅 {fmtDate(b.start_date)} → {fmtDate(b.end_date)}{" "}
                            <span className="muted">({nights} ноч.)</span>
                          </div>
                        </div>
                        <div className="cal-item__actions">
                          <button
                            className="btn-link"
                            onClick={() => setPage("bookings")}
                          >
                            Открыть в «Бронирования»
                          </button>
                          {b.status === "pending" && (
                            <span className="muted">
                              Нажмите «Бронирования», чтобы подтвердить или
                              отклонить
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    if (page === "bookings") {
      return (
        <BookingsTab
          bookings={bookings}
          exchanges={exchanges}
          reloadAll={reloadAll}
          updateBookingStatus={updateBookingStatus}
          decideExchange={decideExchange}
        />
      );
    }
    return null;
  };

  return (
    <div className="app">
      {/* шапка с быстрым выходом */}
      <div className="hedd">
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {" "}
          <path
            d="M21 9.57232L10.9992 1L1 9.57232V21H21V9.57232ZM6.37495 20.4796H1.50704V10.099L6.37495 13.4779V20.4796ZM1.73087 9.62546L6.16178 5.82613L10.6308 9.58795L6.57594 12.9903L1.73087 9.62546ZM10.7632 14.5407L10.745 20.4796H6.88199V13.4076L10.7754 10.1396L10.7617 14.5407H10.7632ZM6.55919 5.48543L10.9992 1.67828L15.4743 5.51512L11.0327 9.25037L6.55919 5.48543ZM11.2703 14.9955H13V17.6789H11.2611V14.9955H11.2703ZM15.2748 13.4936V20.4796H11.2535L11.2611 18.1353H13.5086V14.5407H11.2718L11.2855 10.1365L11.2825 10.1334L15.2764 13.4857V13.4936H15.2748ZM20.4914 20.4796H15.7819V13.9202L20.4914 17.8836V20.4796ZM20.4914 17.21L16.059 13.4811L14.5135 12.1807L11.4317 9.58795L15.8702 5.85583L20.4899 9.81613V17.21H20.4914Z"
            fill="#111827"
            stroke="#111827"
            stroke-linejoin="round"
          />{" "}
        </svg>
        <h1>TEST</h1>
      </div>

      <div className="abs-logo">
        <svg
          width="162"
          height="162"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {" "}
          <path
            d="M21 9.57232L10.9992 1L1 9.57232V21H21V9.57232ZM6.37495 20.4796H1.50704V10.099L6.37495 13.4779V20.4796ZM1.73087 9.62546L6.16178 5.82613L10.6308 9.58795L6.57594 12.9903L1.73087 9.62546ZM10.7632 14.5407L10.745 20.4796H6.88199V13.4076L10.7754 10.1396L10.7617 14.5407H10.7632ZM6.55919 5.48543L10.9992 1.67828L15.4743 5.51512L11.0327 9.25037L6.55919 5.48543ZM11.2703 14.9955H13V17.6789H11.2611V14.9955H11.2703ZM15.2748 13.4936V20.4796H11.2535L11.2611 18.1353H13.5086V14.5407H11.2718L11.2855 10.1365L11.2825 10.1334L15.2764 13.4857V13.4936H15.2748ZM20.4914 20.4796H15.7819V13.9202L20.4914 17.8836V20.4796ZM20.4914 17.21L16.059 13.4811L14.5135 12.1807L11.4317 9.58795L15.8702 5.85583L20.4899 9.81613V17.21H20.4914Z"
            fill="#111827"
            stroke="#111827"
            stroke-linejoin="round"
          />{" "}
        </svg>
      </div>
      <main className="container">{renderContent()}</main>
      {/* нижняя навигация с кнопкой выхода */}
      <BottomNav current={page} onChange={setPage} onLogout={onLogout} />
    </div>
  );
}
