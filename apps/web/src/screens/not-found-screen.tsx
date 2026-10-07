import { EmptyState, Screen } from "@dyslexia/ui";

import { RouterButtonLink } from "../components/links";

export const NotFoundScreen = () => (
  <Screen title="Page not found" titleDisplay="inline">
    <EmptyState
      title="This page does not exist"
      description="The link may be old or mistyped."
      action={<RouterButtonLink to="/">Return home</RouterButtonLink>}
    />
  </Screen>
);
