import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "./styles/globals.css";
import "./i18n";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<React.StrictMode><App /></React.StrictMode>);
