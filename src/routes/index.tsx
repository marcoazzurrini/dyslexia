import { createFileRoute } from "@tanstack/react-router";

const Home = () => (
  <main id="main-content" className="app-shell" tabIndex={-1}>
    <header className="app-header">
      <img src="/icon.svg" alt="" width={44} height={44} />
      <span className="app-name">Dyslexia</span>
    </header>

    <section className="intro" aria-labelledby="page-title">
      <p className="eyebrow">Article listening</p>
      <h1 id="page-title">A home for listening.</h1>
      <p className="intro-text">
        Articles worth your time, ready for your ears.
      </p>
    </section>

    <section className="panel" aria-labelledby="library-title">
      <h2 id="library-title">No articles yet</h2>
      <p>
        This is the starting point. A prepared article recording will be added
        for the first playback test.
      </p>
    </section>

    <section className="install-help" aria-labelledby="install-title">
      <h2 id="install-title">Add to your Home Screen</h2>
      <p>
        On iPhone, open this page in Safari. Tap Share, then Add to Home Screen.
      </p>
      <p className="small-text">
        This first version needs an internet connection. Offline listening is
        not available yet.
      </p>
    </section>
  </main>
);

export const Route = createFileRoute("/")({
  component: Home,
});
