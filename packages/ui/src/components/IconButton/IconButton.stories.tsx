import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { fn } from "storybook/test";

import { IconButton } from "./IconButton";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["secondary", "ghost", "danger"],
    },
    icon: { control: false },
  },
  args: {
    onClick: fn(),
    icon: Pencil,
    label: "Edit",
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {
  args: {
    variant: "secondary",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};

export const Danger: Story = {
  args: {
    icon: Trash2,
    label: "Delete",
    variant: "danger",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

// The confirm/cancel pair a list row swaps to while a delete is pending.
export const ConfirmPair: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 6 }}>
      <IconButton
        {...args}
        icon={Check}
        label="Confirm delete"
        variant="danger"
      />
      <IconButton {...args} icon={X} label="Cancel delete" variant="ghost" />
    </div>
  ),
};
