import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuraDemo } from "./AuraDemo.tsx";
import { App } from "./App.tsx";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <StrictMode>
    {window.location.pathname === "/scratch/aura" ? <AuraDemo /> : <App />}
  </StrictMode>,
);
