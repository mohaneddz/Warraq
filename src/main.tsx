import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "./styles/globals.css";
import "./i18n";
import { getConnection } from "./data/connection";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// The app and its data layer need a database, so they are only loaded once one is configured.
// Until then (a fresh public install) the setup screen runs on its own.
async function start() {
  if (getConnection()) {
    const { App } = await import("./app/App");
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } else {
    const { SetupPage } = await import("./sections/Setup");
    root.render(<React.StrictMode><SetupPage /></React.StrictMode>);
  }
}

void start();
