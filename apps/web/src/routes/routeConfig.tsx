import type { RouteObject } from "react-router-dom";

import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { CampaignDesktopPage } from "../pages/CampaignDesktopPage";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/campaigns/:id",
        element: <CampaignDesktopPage />,
      },
    ],
  },
];
