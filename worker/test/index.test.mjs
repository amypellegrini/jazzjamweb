import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../index.mjs";

function assetsStub() {
  const requests = [];
  return {
    requests,
    fetch: async (request) => {
      requests.push(request);
      return new Response("static page", { status: 200 });
    },
  };
}

test("serves every non-auth request from the static assets", async () => {
  const ASSETS = assetsStub();
  const response = await worker.fetch(new Request("https://jazzjam.app/courses/block-chords/"), { ASSETS });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "static page");
  assert.equal(ASSETS.requests.length, 1);
  assert.equal(new URL(ASSETS.requests[0].url).pathname, "/courses/block-chords/");
});
