import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { routes } from "./routes/routeConfig";

describe("router", () => {
  it("renders the login page at /login", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
