import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapPin, Search, TriangleAlert } from "lucide-react";

import { Icon } from "./Icon";

const meta = {
  title: "Components/Icon",
  component: Icon,
  tags: ["autodocs"],
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Search,
  },
};

export const CustomSize: Story = {
  args: {
    icon: MapPin,
    size: 32,
  },
};

export const AccentColor: Story = {
  args: {
    icon: TriangleAlert,
    color: "var(--accent)",
  },
};
