import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "secondary", "ghost", "text", "destructive", "tab"],
    },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Save changes",
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    children: "Cancel",
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    children: "Save changes",
    disabled: true,
  },
};

export const Ghost: Story = {
  args: {
    children: "Reset layout",
    variant: "ghost",
  },
};

export const Text: Story = {
  args: {
    children: "Never mind",
    variant: "text",
  },
};

export const Destructive: Story = {
  args: {
    children: "Archive campaign",
    variant: "destructive",
  },
};

export const Tab: Story = {
  args: {
    children: "Notes",
    variant: "tab",
    "aria-pressed": true,
  },
};
