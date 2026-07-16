import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./Input";

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "campaign@example.com",
  },
};

export const Invalid: Story = {
  args: {
    placeholder: "campaign@example.com",
    invalid: true,
    defaultValue: "not-an-email",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "campaign@example.com",
    disabled: true,
  },
};
