import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Checkbox } from "./Checkbox";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "campaign@example.com",
  },
};

export const Checked: Story = {
  args: {
    label: "campaign@example.com",
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "campaign@example.com",
    disabled: true,
  },
};
