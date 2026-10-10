// Screens arrange components; the component library decides how things
// look. A screen that sets type, color, or shape would drift from the rest
// of the app, as Library's rows once did, so this check fails the build.
// Layout (spacing, flex, size, motion) stays allowed.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SCREENS = path.join(import.meta.dirname, "../src/screens");

const LOOKS =
  /^\s*(?<property>backgroundColor|backgroundImage|borderColor|borderRadius|boxShadow|color|fontFamily|fontSize|fontWeight|letterSpacing|lineHeight|outline\w*|textDecoration\w*)\s*:/u;

const problems = readdirSync(SCREENS)
  .filter((name) => name.endsWith(".tsx"))
  .flatMap((name) =>
    readFileSync(path.join(SCREENS, name), "utf-8")
      .split("\n")
      .flatMap((line, index) => {
        const property = LOOKS.exec(line)?.groups?.property;
        return property
          ? [`src/screens/${name}:${index + 1} sets ${property}`]
          : [];
      })
  );

if (problems.length > 0) {
  console.error(
    [
      "Screens may only lay out components. Move these looks into @dyslexia/ui:",
      ...problems.map((problem) => `  ${problem}`),
    ].join("\n")
  );
  process.exit(1);
}
