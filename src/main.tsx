import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LiveProviders } from "./live/LiveProviders";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import "./components/components.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LiveProviders>
      <App />
    </LiveProviders>
  </React.StrictMode>
);
