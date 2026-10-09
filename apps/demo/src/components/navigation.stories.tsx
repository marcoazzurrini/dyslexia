import {
  ChipGroup,
  HomeIcon,
  LibraryIcon,
  PersonIcon,
  TabBar,
  TabBarLink,
} from "@dyslexia/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = {
  args: { label: "Main", selected: 0, tabs: [] },
  component: TabBar,
  title: "Components/Navigation",
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const TABS = [
  { icon: <HomeIcon />, label: "Home" },
  { icon: <LibraryIcon />, label: "Library" },
  { icon: <PersonIcon />, label: "Profile" },
];

const TabsDemo = () => {
  const [selected, setSelected] = useState(0);
  return (
    <TabBar
      label="Main"
      selected={selected}
      tabs={TABS.map((tab, index) => (
        <TabBarLink
          key={tab.label}
          href="#"
          icon={tab.icon}
          label={tab.label}
          selected={index === selected}
          onClick={(event) => {
            event.preventDefault();
            setSelected(index);
          }}
        />
      ))}
    />
  );
};

/** The floating tab bar. Press a tab to watch the pill slide to it. */
export const Tabs: Story = { render: () => <TabsDemo /> };

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Not started", value: "not-started" },
  { label: "In progress", value: "in-progress" },
  { label: "Finished", value: "finished" },
] as const;

const FiltersDemo = () => {
  const [value, setValue] = useState<(typeof FILTERS)[number]["value"]>("all");
  return (
    <ChipGroup
      label="Show"
      options={FILTERS}
      value={value}
      onChange={setValue}
    />
  );
};

/** Filters that scroll sideways when they do not fit. */
export const Filters: Story = { render: () => <FiltersDemo /> };
