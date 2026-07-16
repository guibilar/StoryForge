import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Dock } from "./Dock";
import type { DockItem } from "./Dock";

const meta = {
  title: "Components/Dock",
  component: Dock,
  tags: ["autodocs"],
} satisfies Meta<typeof Dock>;

export default meta;
type Story = StoryObj<typeof meta>;

const initialItems: DockItem[] = [
  { id: "npcs", title: "NPCs", open: true },
  { id: "members", title: "Members", open: true },
  { id: "sessions", title: "Sessions", open: false },
];

export const Default: Story = {
  args: {
    items: initialItems,
    onToggle: () => {},
  },
  render: function Render(args) {
    const [items, setItems] = useState(args.items);

    return (
      <Dock
        {...args}
        items={items}
        onToggle={(id) =>
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, open: !item.open } : item,
            ),
          )
        }
      />
    );
  },
};
