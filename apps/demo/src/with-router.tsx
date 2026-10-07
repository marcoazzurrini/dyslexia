import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

/**
 * Screens use router links. This gives each story a router of its own that
 * renders the story on every path, so links work without leaving it.
 */
export const withRouter: Decorator = (Story) => {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({ component: () => <Story /> }),
  });
  return <RouterProvider router={router} />;
};
