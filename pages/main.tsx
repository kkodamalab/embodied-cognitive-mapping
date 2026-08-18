import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { CognitiveMap } from "../app/components/CognitiveMap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CognitiveMap />
  </StrictMode>,
);
