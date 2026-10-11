import {
  HomeIcon,
  LibraryIcon,
  PersonIcon,
  PlusIcon,
  scrollScreenToTop,
  TabBar,
  TabBarAction,
} from "@dyslexia/ui";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { RouterTabBarLink } from "./links";

const TABS = [
  { icon: <HomeIcon />, label: "Home", to: "/" },
  { icon: <LibraryIcon />, label: "Library", to: "/library" },
  { icon: <PersonIcon />, label: "Profile", to: "/profile" },
] as const;

/**
 * The app's top-level destinations and adding an article, in reach on every
 * screen, with the mini player sliding out above once something plays.
 */
export const AppTabBar = ({
  accessory,
  onAdd,
}: {
  accessory?: ReactNode;
  onAdd: () => void;
}) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const selected = TABS.findIndex((tab) => tab.to === pathname);
  return (
    <TabBar
      label="Main"
      accessory={accessory}
      action={
        <TabBarAction label="Add article" icon={<PlusIcon />} onClick={onAdd} />
      }
      tabs={TABS.map((tab, index) => (
        <RouterTabBarLink
          key={tab.to}
          to={tab.to}
          icon={tab.icon}
          label={tab.label}
          selected={index === selected}
          onClick={() => {
            // As in iOS, pressing the open tab again returns to its top.
            if (index === selected) {
              scrollScreenToTop();
            }
          }}
        />
      ))}
    />
  );
};
