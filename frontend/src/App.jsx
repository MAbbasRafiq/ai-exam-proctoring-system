// =============================================================
// src/App.jsx
// Root component that sets up page routing.
// Uses react-router-dom to map URLs to page components.
//
// Routes:
//   /          -> Exam page (requires login)
//   /login     -> Login page
//   /register  -> Register page
// =============================================================

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Exam from "./pages/Exam";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  return (
    // BrowserRouter enables client-side routing
    <BrowserRouter>
      <Routes>
        {/* Main exam page */}
        <Route path="/" element={<Exam />} />

        {/* Authentication pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
