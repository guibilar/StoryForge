import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteSection } from "./CommandPalette";

const meta = {
  title: "Components/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  args: {
    onQueryChange: fn(),
    onActiveChange: fn(),
    onCommit: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleSections: CommandPaletteSection[] = [
  {
    label: "Recent",
    items: [
      { id: "recent-1", label: "Whisper Amulet", sublabel: "Entity" },
      { id: "recent-2", label: "Chapter 3: The Hollow", sublabel: "Scene" },
    ],
  },
  {
    label: "Actions",
    items: [
      { id: "action-new-entity", label: "New entity", sublabel: "Create" },
      { id: "action-new-relationship", label: "New relationship" },
      { id: "action-export", label: "Export campaign" },
    ],
  },
];

export const Default: Story = {
  args: {
    open: true,
    query: "",
    sections: sampleSections,
    activeId: "recent-1",
  },
  render: function Render(args) {
    const [query, setQuery] = useState(args.query);
    const [activeId, setActiveId] = useState(args.activeId);

    return (
      <CommandPalette
        {...args}
        query={query}
        onQueryChange={setQuery}
        activeId={activeId}
        onActiveChange={setActiveId}
        onCommit={(id) => {
          args.onCommit(id);
        }}
      />
    );
  },
};

export const Empty: Story = {
  args: {
    open: true,
    query: "xyzzy",
    sections: [
      { label: "Recent", items: [] },
      { label: "Actions", items: [] },
    ],
    activeId: null,
  },
  render: function Render(args) {
    const [query, setQuery] = useState(args.query);

    return <CommandPalette {...args} query={query} onQueryChange={setQuery} />;
  },
};
