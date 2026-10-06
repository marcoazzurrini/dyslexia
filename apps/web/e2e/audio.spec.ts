import { expect, test } from "@playwright/test";

for (const mode of ["navigate", "cors"]) {
  test(`unknown audio returns 404 rather than HTML for ${mode} requests`, async ({
    request,
  }) => {
    const response = await request.get("/audio/not-a-recording.mp3", {
      headers: { "Sec-Fetch-Mode": mode },
    });
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).not.toContain("text/html");
    expect(await response.text()).toBe("Recording not found");
  });
}

test("unknown audio HEAD returns no body", async ({ request }) => {
  const response = await request.head("/audio/not-a-recording.mp3");
  expect(response.status()).toBe(404);
  const body = await response.body();
  expect(body.length).toBe(0);
});
