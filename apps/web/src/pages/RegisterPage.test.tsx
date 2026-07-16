import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { RegisterPage } from "./RegisterPage";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function mockRegister(
  result: unknown,
  state: { fetching?: boolean; error?: unknown } = {},
) {
  const register = vi.fn().mockResolvedValue(result);
  vi.mocked(useMutation).mockReturnValue([
    { fetching: false, stale: false, ...state } as never,
    register as never,
  ]);
  return register;
}

describe("RegisterPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("renders the registration form", () => {
    mockRegister({ data: undefined });
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Register" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("submits credentials and navigates to /dashboard on success", async () => {
    const register = mockRegister({
      data: { registerUser: { user: { id: "1", email: "new@b.com" } } },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "new@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(register).toHaveBeenCalledWith({
      input: { email: "new@b.com", password: "secret123" },
    });
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the GraphQL error and does not navigate on failure", async () => {
    mockRegister(
      { data: undefined },
      {
        error: {
          graphQLErrors: [
            { message: "An account with this email already exists." },
          ],
        },
      },
    );
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "An account with this email already exists.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
