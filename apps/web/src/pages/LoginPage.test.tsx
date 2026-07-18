import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { LoginPage } from "./LoginPage";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function mockLogin(
  result: unknown,
  state: { fetching?: boolean; error?: unknown } = {},
) {
  const login = vi.fn().mockResolvedValue(result);
  vi.mocked(useMutation).mockReturnValue([
    { fetching: false, stale: false, ...state } as never,
    login as never,
  ]);
  return login;
}

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("renders the login form", () => {
    mockLogin({ data: undefined });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("submits credentials and navigates to /dashboard on success", async () => {
    const login = mockLogin({
      data: { login: { user: { id: "1", email: "a@b.com" } } },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith({
      input: { email: "a@b.com", password: "secret123" },
    });
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the GraphQL error and does not navigate on failure", async () => {
    mockLogin(
      { data: undefined },
      {
        error: {
          graphQLErrors: [{ message: "Invalid email or password." }],
        },
      },
    );
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
