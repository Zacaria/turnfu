import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx?v=module-stat-icons-v1";
import "./styles.css?v=module-stat-icons-v1";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
