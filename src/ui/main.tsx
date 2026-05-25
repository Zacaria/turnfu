import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx?v=center-tabs-v6";
import "./styles.css?v=center-tabs-v6";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
