import { useSyncExternalStore } from "react";

import type { Article } from "./article";
import { ARTICLE } from "./article";

// Only the current browser tab owns a selection. No token or private job
// metadata is persisted, and server rendering always uses the default article.
let selectedArticle: Article = ARTICLE;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const selectArticle = (article: Article) => {
  if (typeof window === "undefined") {
    return;
  }
  if (
    selectedArticle.id === article.id &&
    selectedArticle.version === article.version
  ) {
    return;
  }
  selectedArticle = article;
  for (const listener of listeners) {
    listener();
  }
};

export const useSelectedArticle = () =>
  useSyncExternalStore(
    subscribe,
    () => selectedArticle,
    () => ARTICLE
  );
