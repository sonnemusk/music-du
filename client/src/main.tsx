import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA shell only (no audio/API cache) — free, no CF paid services
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((reg) => {
      // F-8: activate waiting worker ASAP
      reg.update?.().catch(() => {});
      if (reg.waiting) reg.waiting.postMessage?.({ type: "SKIP_WAITING" });
    }).catch(() => {});
  });
  // One reload when a NEW worker takes over an already-controlled page.
  // On a first visit the page starts uncontrolled and clients.claim() fires
  // controllerchange too — reloading there cost a second full boot, re-randomised
  // the pre-warmed track and discarded whatever tab the user had just opened.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    try {
      if (sessionStorage.getItem("music-sw-reloaded") === "1") return;
      sessionStorage.setItem("music-sw-reloaded", "1");
    } catch {
      /* */
    }
    refreshing = true;
    window.location.reload();
  });
}
