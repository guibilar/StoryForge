import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select } from "./Select";

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "Visibility",
    defaultValue: "PUBLIC",
    children: (
      <>
        <option value="PUBLIC">Public</option>
        <option value="TARGETED">Targeted</option>
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    "aria-label": "Visibility",
    disabled: true,
    children: <option value="PUBLIC">Public</option>,
  },
};
