import Preloader from "/src/components/preloader/Preloader.jsx";
import Authform from "/src/components/authform/Authform";
import User from "/src/pages/User.jsx";
import Admin from "/src/pages/Admin.jsx";
import "./App.css";

import { useState, useEffect } from "react";

function App() {
  const [loading, setLoading] = useState(true);
  // "auth" | "user" | "admin"
  const [stage, setStage] = useState("auth");
  const [me, setMe] = useState(null); // объект пользователя из бэка

  const API = "";


  async function handleLogout() {
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include", // обязательно, чтобы куку удалило
    });
  } catch (err) {
    console.warn("Logout error:", err);
  } finally {
    setMe(null);
    setStage("auth");
  }
}


  // Автовход по куке
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, {
          method: "GET",
          credentials: "include", // важно для куки
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.user) {
            setMe(data.user);
            setStage(data.user?.role === "admin" ? "admin" : "user");
          }
        }
      } catch (err) {
        console.warn("Auto-login error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLoginSuccess(user) {
    setMe(user);
    setStage(user?.role === "admin" ? "admin" : "user");
  }

  return (
    <div className="container">
      {loading ? (
        <Preloader />
      ) : stage === "auth" ? (
        <Authform onLoginSuccess={handleLoginSuccess} />
      ) : stage === "admin" ? (
        <Admin user={me} onLogout={handleLogout}  />
      ) : (
        <User user={me} onLogout={handleLogout}  />
      )}
    </div>
  );
}

export default App;
