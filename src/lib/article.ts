export interface Article {
  audioUrl: string;
  author: string;
  durationSeconds: number;
  id: string;
  sourceUrl: string;
  title: string;
  version: string;
}

export const ARTICLE = {
  audioUrl: "/audio/conway-b2ac2e01fb55c21c.mp3",
  author: "Dan Abramov",
  durationSeconds: 3034.32,
  id: "conway-proof",
  sourceUrl:
    "https://overreacted.io/how-i-vibed-a-proof-of-conways-conjecture/",
  title: "How I Vibed a Proof of Conway’s Conjecture",
  version: "b2ac2e01fb55c21c",
} as const;
