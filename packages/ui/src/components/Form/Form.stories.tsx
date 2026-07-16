import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "../Button/Button";
import { Input } from "../Input/Input";
import { Form } from "./Form";
import { FormError } from "./FormError";
import { FormField } from "./FormField";

const meta = {
  title: "Components/Form",
  component: Form,
  tags: ["autodocs"],
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

// A composed sign-up-style form, matching the pattern used by
// CreateCampaignDialog: Form + FormError + FormField + Input + Button.
export const Composition: Story = {
  args: {
    onSubmit: fn((event) => event.preventDefault()),
  },
  render: (args) => (
    <Form
      {...args}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <FormError>{null}</FormError>
      <FormField label="Name" htmlFor="story-campaign-name">
        <Input id="story-campaign-name" name="name" required />
      </FormField>
      <FormField label="Description" htmlFor="story-campaign-description">
        <Input id="story-campaign-description" name="description" />
      </FormField>
      <Button type="submit">Create</Button>
    </Form>
  ),
};

export const WithSubmitError: Story = {
  args: {
    onSubmit: fn((event) => event.preventDefault()),
  },
  render: (args) => (
    <Form
      {...args}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <FormError>A campaign with that name already exists.</FormError>
      <FormField label="Name" htmlFor="story-campaign-name-error">
        <Input
          id="story-campaign-name-error"
          name="name"
          defaultValue="The Sabbat War"
          required
        />
      </FormField>
      <Button type="submit">Create</Button>
    </Form>
  ),
};
