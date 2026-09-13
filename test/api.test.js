import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { listModels, streamChat } from "../src/api.js";

function serverFor(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

test("listModels reads OpenAI-style data", async () => {
  const server = await serverFor((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "alpha" }, { id: "beta" }, { id: "alpha" }] }));
  });
  const { port } = server.address();
  try {
    assert.deepEqual(await listModels(`http://127.0.0.1:${port}/v1`, ""), ["alpha", "beta"]);
  } finally {
    await close(server);
  }
});

test("streamChat parses split SSE events", async () => {
  const server = await serverFor((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"hel"}}]}\n');
    setTimeout(() => {
      res.write('\n');
      res.write('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }, 5);
  });
  const { port } = server.address();
  try {
    const chunks = [];
    for await (const chunk of streamChat({
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "",
      model: "test",
      messages: [{ role: "user", content: "hi" }],
    })) chunks.push(chunk);
    assert.equal(chunks.join(""), "hello");
  } finally {
    await close(server);
  }
});
