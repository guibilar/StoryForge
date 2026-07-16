import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Link } from "./Link";

describe("Link", () => {
  it("renders as an anchor by default", () => {
    render(<Link href="/dashboard">Dashboard</Link>);

    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders as the element passed via the as prop", () => {
    function FakeRouterLink({
      to,
      children,
    }: {
      to: string;
      children: React.ReactNode;
    }) {
      return <a href={to}>{children}</a>;
    }

    render(
      <Link as={FakeRouterLink} to="/register">
        Register
      </Link>,
    );

    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
