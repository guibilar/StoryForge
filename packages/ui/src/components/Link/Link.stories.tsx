import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./Link";

const meta = {
  title: "Components/Link",
  component: Link,
  tags: ["autodocs"],
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    href: "#",
    children: "Back to dashboard",
  },
};

export const AsButton: Story = {
  args: {
    as: "button",
    type: "button",
    children: "Rendered as a <button>",
  },
};
