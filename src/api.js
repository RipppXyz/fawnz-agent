function normalizeBaseUrl(url) {
  let u = String(url || "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("router base URL is empty");
  if (!/\/v1$/i.test(u)) u += "/v1";
  return u;
}

function authHeaders(apiKey, extra = {}) {
  return apiKey ? { ...extra, Authorization: `Bearer ${apiKey}` } : { ...extra };
}

async function readErrorBody(res) {
  const body = await res.text().catch(() => "");
  return body.replace(/\s+/g, " ").trim().slice(0, 500);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: options.signal || controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`request timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(baseUrl, apiKey) {
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  let res;
  try {
    res = await fetchWithTimeout(url, { headers: authHeaders(apiKey) });
  } catch (err) {
    throw new Error(`cannot connect to ${url} (${err.message})`);
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`router returned ${res.status}${body ? `: ${body}` : ""}`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("router returned invalid JSON");
  }
}

export async function listModels(baseUrl, apiKey) {
  const data = await testConnection(baseUrl, apiKey);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.result)
          ? data.result
          : [];

  const ids = items
    .map((model) =>
      typeof model === "string" ? model : model?.id || model?.name || model?.model || model?.slug
    )
    .filter(Boolean)
    .map(String);

  return [...new Set(ids)];
}

export function collapseModelVariants(models) {
  const seenBase = new Set();
  const result = [];
  for (const model of models) {
    const value = String(model);
    const base = value.split(":")[0];
    if (seenBase.has(base)) continue;
    seenBase.add(base);
    result.push(value);
  }
  return result;
}

function extractContent(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.content === "string") return part.content;
      return "";
    })
    .join("");
}

function extractDelta(json) {
  const choice = json?.choices?.[0];
  const delta = extractContent(choice?.delta?.content ?? choice?.message?.content);
  if (delta) return delta;
  return extractContent(json?.response ?? json?.content ?? json?.text);
}

function parseSseData(payload) {
  const raw = String(payload ?? "").trim();
  if (!raw || raw === "[DONE]") return { done: raw === "[DONE]", text: "" };
  try {
    return { done: false, text: extractDelta(JSON.parse(raw)) };
  } catch {
    return { done: false, text: "" };
  }
}

export async function* streamChat({ baseUrl, apiKey, model, messages, signal }) {
  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: authHeaders(apiKey, {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        }),
        body: JSON.stringify({ model, messages, stream: true }),
        signal,
      },
      120_000
    );
  } catch (err) {
    throw new Error(`router request failed: ${err.message}`);
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`router error ${res.status}${body ? `: ${body}` : ""}`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.body || !contentType.includes("text/event-stream")) {
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("router returned a non-streaming response that is not valid JSON");
    }
    const text = extractDelta(data);
    if (text) yield text;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  const consumeEvent = function* (event) {
    const dataLines = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (!dataLines.length) return;
    const parsed = parseSseData(dataLines.join("\n"));
    if (parsed.done) {
      sawDone = true;
      return;
    }
    if (parsed.text) yield parsed.text;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = -1;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
      for (const chunk of consumeEvent(event)) yield chunk;
      if (sawDone) return;
    }
  }

  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail && !sawDone) {
    for (const chunk of consumeEvent(tail)) yield chunk;
  }
}

export { normalizeBaseUrl };
