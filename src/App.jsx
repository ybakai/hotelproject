import Preloader from "/src/components/preloader/Preloader.jsx";
import Authform from "/src/components/authform/Authform";
import "./App.css";

import { useState, useEffect } from "react";

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4000); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="container">
         {loading ? <Preloader /> : <Authform />}
      </div>
    </>
  );
}

export default App;
