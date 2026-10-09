import { HomeIcon, LibraryIcon, PersonIcon, TabBar } from "@dyslexia/ui";
import { useLocation } from "@tanstack/react-router";

import { RouterTabBarLink } from "./links";

const TABS = [
  { icon: <HomeIcon />, label: "Home", to: "/" },
  { icon: <LibraryIcon />, label: "Library", to: "/library" },
  { icon: <PersonIcon />, label: "Profile", to: "/profile" },
] as const;

/** The app's top-level destinations, in reach on every screen. */
export const AppTabBar = () => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const selected = TABS.findIndex((tab) => tab.to === pathname);
  return (
    <TabBar
      label="Main"
      selected={selected}
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
              window.scrollTo({ behavior: "smooth", top: 0 });
            }
          }}
        />
      ))}
    />
  );
};
