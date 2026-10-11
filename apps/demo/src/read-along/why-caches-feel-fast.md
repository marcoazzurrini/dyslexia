# Why caches make apps feel fast

Every time an app asks a server for something, it waits. On a good connection the wait is short, but it adds up: a screen that needs ten answers can feel slow even when each answer is quick.

A cache keeps a copy of an answer close by, so the next time the app needs it, the answer is already there.

![The app asks the cache first, and goes to the server only when the cache does not have the answer.](https://example.org/read-along/cache-diagram.svg)

## A cache in a few lines

Here is the smallest useful cache. It remembers each answer by the question that produced it.

```ts
const cache = new Map<string, string>();

async function lookUp(question: string) {
  const known = cache.get(question);
  if (known) return known;
  const answer = await askServer(question);
  cache.set(question, answer);
  return answer;
}
```

## How much it saves

| Where the answer comes from | Typical wait           |
| --------------------------- | ---------------------- |
| Memory                      | under a millisecond    |
| Disk                        | a few milliseconds     |
| Network                     | 50 to 500 milliseconds |

The trade-off is freshness. A cached answer can go stale, so real caches decide how long to keep each copy, and when to ask again.
