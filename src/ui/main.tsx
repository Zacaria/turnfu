import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuraDemo } from "./AuraDemo.tsx?v=energy-no-spikes-v1";
import { App } from "./App.tsx?v=resources-state-tracker-v2";
import "./styles.css?v=resources-state-tracker-v2";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <StrictMode>
    {window.location.pathname === "/scratch/aura" ? <AuraDemo /> : <App />}
  </StrictMode>,
);
