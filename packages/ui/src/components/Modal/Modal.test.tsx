import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders its content and opens the dialog when open", () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByText("Modal content").closest("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("open");
  });

  it("does not open the dialog when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByText("Modal content").closest("dialog");
    expect(dialog).not.toHaveAttribute("open");
  });

  it("calls onClose when a click lands on the dialog backdrop", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByText("Modal content").closest("dialog")!;
    await user.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the content", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );

    await user.click(screen.getByText("Modal content"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the dialog is cancelled (Escape)", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByText("Modal content").closest("dialog")!;
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
