import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "../Button/Button";
import { Modal } from "./Modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  tags: ["autodocs"],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    children: null,
  },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);

    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal {...args} open={open} onClose={() => setOpen(false)}>
          <h2>New campaign</h2>
          <p>This modal is controlled by local story state.</p>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </Modal>
      </>
    );
  },
};
