import Preloader from "/src/components/preloader/Preloader.jsx";
import Authform from "/src/components/authform/Authform";
import Test from "/src/Test.jsx";
import "./App.css";

import { useState, useEffect } from "react";

function App() {
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("auth"); 
  // "auth" | "test"

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // коллбэк для успешного логина
  function handleLoginSuccess() {
    setStage("test");
  }

  return (
    <div className="container">
      {loading ? (
        <Preloader />
      ) : stage === "auth" ? (
        <Authform onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Test />
      )}
    </div>
  );
}

export default App;
