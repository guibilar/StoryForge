import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "../Button/Button";
import { FormActions } from "./FormActions";

const meta = {
  title: "Components/FormActions",
  component: FormActions,
  tags: ["autodocs"],
} satisfies Meta<typeof FormActions>;

export default meta;
type Story = StoryObj<typeof meta>;

// The Cancel + Submit footer used at the bottom of every entity/event/note/
// session/marker/territory form window and ManageCampaignModal.
export const CancelAndSubmit: Story = {
  render: () => (
    <FormActions>
      <Button type="button" variant="secondary" onClick={fn()}>
        Cancel
      </Button>
      <Button type="submit">Save</Button>
    </FormActions>
  ),
};

// TerritoryFormWindow's edit mode adds a Delete button ahead of Cancel/Save.
export const WithLeadingDestructiveAction: Story = {
  render: () => (
    <FormActions>
      <Button type="button" variant="secondary" onClick={fn()}>
        Delete
      </Button>
      <Button type="button" variant="secondary" onClick={fn()}>
        Cancel
      </Button>
      <Button type="submit">Save</Button>
    </FormActions>
  ),
};
