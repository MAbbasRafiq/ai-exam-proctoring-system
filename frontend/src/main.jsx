// =============================================================
// src/main.jsx
// Entry point for the React app.
// This is the file that Vite compiles and injects into index.html.
// =============================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Find the <div id="root"> in index.html and render our App inside it
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
