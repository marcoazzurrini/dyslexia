import type {
  Image,
  Link,
  Paragraph,
  PhrasingContent,
  RootContent,
} from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";

import type { Visual } from "./format.ts";

/** A part of the article: text for the voice, or a visual to show. */
export type Block =
  | { readonly kind: "text"; readonly markdown: string }
  | {
      readonly kind: "visual";
      readonly markdown: string;
      readonly visual: Visual;
    };

const isBlank = (node: PhrasingContent) =>
  node.type === "break" || (node.type === "text" && !node.value.trim());

/** An image, or a link around only an image, as pages often wrap them. */
const imageIn = (node: PhrasingContent): Image | null => {
  if (node.type === "image") {
    return node;
  }
  const inner =
    node.type === "link"
      ? (node satisfies Link).children.filter((child) => !isBlank(child))
      : [];
  const [only] = inner;
  return inner.length === 1 && only?.type === "image" ? only : null;
};

/** The images of a paragraph that holds nothing else, or null. */
const imagesOnly = (paragraph: Paragraph) => {
  const images = paragraph.children
    .filter((child) => !isBlank(child))
    .map(imageIn);
  return images.length > 0 && images.every((image) => image !== null)
    ? images
    : null;
};

/** A web address for a picture, or null for inline data and the like. */
const pictureAddress = (src: string, base: string) => {
  const url = URL.parse(src, base);
  return url?.protocol === "https:" || url?.protocol === "http:"
    ? url.href
    : null;
};

/** The visuals a block of the article shows, or null for text. */
const visualsOf = (node: RootContent, base: string): Visual[] | null => {
  switch (node.type) {
    case "code": {
      return [{ code: node.value, kind: "code", language: node.lang ?? null }];
    }
    case "table": {
      const [head, ...rows] = node.children.map((row) =>
        row.children.map((cell) => toString(cell).trim())
      );
      return [{ head: head ?? [], kind: "table", rows }];
    }
    case "paragraph": {
      return (
        imagesOnly(node)?.flatMap((image) => {
          const src = pictureAddress(image.url, base);
          return src
            ? [{ alt: image.alt?.trim() ?? "", kind: "image", src }]
            : [];
        }) ?? null
      );
    }
    default: {
      return null;
    }
  }
};

// Nothing to say or show.
const SKIPPED = new Set(["definition", "thematicBreak", "yaml"]);

/**
 * Splits an article's Markdown into blocks, in order. Code, tables, and
 * paragraphs of only pictures are visuals; everything else is text, kept as
 * written. Picture addresses are resolved against `base`, the page's link.
 */
export const parseBlocks = (markdown: string, base: string): Block[] => {
  const text = markdown.replaceAll(/\r\n?/gu, "\n");
  const root = fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  return root.children.flatMap((node): Block[] => {
    if (SKIPPED.has(node.type)) {
      return [];
    }
    const source = text
      .slice(node.position?.start.offset, node.position?.end.offset)
      .trim();
    const visuals = visualsOf(node, base);
    if (!visuals) {
      return source ? [{ kind: "text", markdown: source }] : [];
    }
    // Each picture of a row of pictures stands on its own.
    return visuals.map((visual) => ({
      kind: "visual",
      markdown:
        visual.kind === "image" && visuals.length > 1
          ? `![${visual.alt}](${visual.src})`
          : source,
      visual,
    }));
  });
};
