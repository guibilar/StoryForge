import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "../Input/Input";
import { FormField } from "./FormField";

const meta = {
  title: "Components/FormField",
  component: FormField,
  tags: ["autodocs"],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Email",
    htmlFor: "story-field-email",
    children: <Input id="story-field-email" name="email" type="email" />,
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    htmlFor: "story-field-email-error",
    error: "Enter a valid email address.",
    children: (
      <Input
        id="story-field-email-error"
        name="email"
        type="email"
        invalid
        defaultValue="not-an-email"
      />
    ),
  },
};
