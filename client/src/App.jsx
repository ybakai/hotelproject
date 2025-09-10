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

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
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
        <Admin user={me} />
      ) : (
        <User user={me} />
      )}
    </div>
  );
}

export default App;
