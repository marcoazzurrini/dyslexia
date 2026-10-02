import { createFileRoute, Link } from "@tanstack/react-router";

import { ARTICLE } from "../lib/article";
import { selectArticle, useSelectedArticle } from "../lib/selected-article";

const Home = () => {
  const article = useSelectedArticle();
  return (
    <main id="main-content" className="app-shell" tabIndex={-1}>
      <header className="app-header">
        <img src="/icon.svg" alt="" width={44} height={44} />
        <span className="app-name">Dyslexia</span>
        <Link className="text-link header-link" to="/create">
          Create narration
        </Link>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Article listening</p>
        <h1 id="page-title">{article.title}</h1>
        <p className="intro-text">
          By {article.author} ·{" "}
          {article.durationSeconds > 0
            ? `${Math.ceil(article.durationSeconds / 60)} min`
            : "Duration unavailable"}
        </p>
        <a
          className="text-link"
          href={article.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Read the original article (opens in a new tab)
        </a>
        {article.id !== ARTICLE.id && (
          <div className="selection-reset">
            <button type="button" onClick={() => selectArticle(ARTICLE)}>
              Listen to the original recording
            </button>
          </div>
        )}
      </section>
    </main>
  );
};

export const Route = createFileRoute("/")({
  component: Home,
});
