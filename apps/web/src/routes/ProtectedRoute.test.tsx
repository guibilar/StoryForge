import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "urql";

import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn() };
});

function renderProtected() {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Secret dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("renders nothing while the me query is in flight", () => {
    vi.mocked(useQuery).mockReturnValue([
      { data: undefined, fetching: true, stale: false } as never,
      vi.fn(),
    ]);

    renderProtected();

    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("redirects to /login when there is no current user", () => {
    vi.mocked(useQuery).mockReturnValue([
      { data: { me: null }, fetching: false, stale: false } as never,
      vi.fn(),
    ]);

    renderProtected();

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected content when there is a current user", () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        data: { me: { id: "1", email: "a@b.com" } },
        fetching: false,
        stale: false,
      } as never,
      vi.fn(),
    ]);

    renderProtected();

    expect(screen.getByText("Secret dashboard")).toBeInTheDocument();
  });
});
