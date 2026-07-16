import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Window } from "./Window";

const meta = {
  title: "Components/Window",
  component: Window,
  tags: ["autodocs"],
  args: {
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Window>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "NPCs",
    style: { position: "absolute", left: 0, top: 0, width: 320, height: 260 },
    children: <p style={{ padding: 12 }}>Window content goes here.</p>,
  },
};
