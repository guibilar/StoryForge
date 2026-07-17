import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Tabs } from "./Tabs";

const items = [
  { id: "overview", label: "Overview" },
  { id: "notes", label: "Notes" },
  { id: "history", label: "History" },
];

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const panelContent: Record<string, string> = {
  overview: "A quick summary of the campaign's current status.",
  notes: "Freeform notes captured during the last session.",
  history: "A log of every change made to this entity.",
};

export const Interactive: Story = {
  args: {
    items,
    activeId: "overview",
    children: null,
  },
  render: function Render(args) {
    const [activeId, setActiveId] = useState(args.activeId);

    return (
      <Tabs
        {...args}
        activeId={activeId}
        onChange={(id) => {
          args.onChange(id);
          setActiveId(id);
        }}
      >
        {panelContent[activeId]}
      </Tabs>
    );
  },
};

export const TwoTabs: Story = {
  args: {
    items: items.slice(0, 2),
    activeId: "overview",
    children: panelContent.overview,
  },
};
