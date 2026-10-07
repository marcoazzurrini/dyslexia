import { ButtonLink, IconLink, ListLink } from "@dyslexia/ui";
import { createLink } from "@tanstack/react-router";

// Router-aware versions of the design system's link components.
export const RouterListLink = createLink(ListLink);
export const RouterIconLink = createLink(IconLink);
export const RouterButtonLink = createLink(ButtonLink);
