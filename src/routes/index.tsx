import { createFileRoute } from "@tanstack/react-router";

import { ARTICLE } from "../lib/article";

const Home = () => (
  <main id="main-content" className="app-shell" tabIndex={-1}>
    <header className="app-header">
      <img src="/icon.svg" alt="" width={44} height={44} />
      <span className="app-name">Dyslexia</span>
    </header>

    <section className="intro" aria-labelledby="page-title">
      <p className="eyebrow">Article listening</p>
      <h1 id="page-title">{ARTICLE.title}</h1>
      <p className="intro-text">
        By {ARTICLE.author} · {Math.ceil(ARTICLE.durationSeconds / 60)} min
      </p>
      <a
        className="text-link"
        href={ARTICLE.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        Read the original article (opens in a new tab)
      </a>
    </section>
  </main>
);

export const Route = createFileRoute("/")({
  component: Home,
});
