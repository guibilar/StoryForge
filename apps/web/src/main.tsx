import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Provider } from "urql";
import "./index.css";
import { router } from "./router";
import { urqlClient } from "./lib/urqlClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider value={urqlClient}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
