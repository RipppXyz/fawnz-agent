function normalizeBaseUrl(url) {
  let u = url.trim();
  if (u.endsWith("/")) u = u.slice(0, -1);
  if (!u.endsWith("/v1")) u += "/v1";
  return u;
}

export async function testConnection(baseUrl, apiKey) {
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  let res;
  try {
    res = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
  } catch (err) {
    throw new Error(`tidak bisa konek ke ${url} (${err.message})`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`router membalas status ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

/**
 * Tarik daftar model dari 9router. Mendukung beberapa bentuk respons
 * yang umum dipakai endpoint bergaya OpenAI-compatible:
 *   { data: [{ id: "..." }, ...] }   <- format standar /v1/models
 *   { models: ["...", ...] }
 *   ["...", ...]                     <- array polos
 */
export async function listModels(baseUrl, apiKey) {
  const data = await testConnection(baseUrl, apiKey);
  const items = Array.isArray(data)
    ? data
    : data?.data || data?.models || data?.result || [];

  const ids = items
    .map((m) => (typeof m === "string" ? m : m?.id || m?.name))
    .filter(Boolean);

  // hapus duplikat sambil pertahankan urutan asli dari router
  return [...new Set(ids)];
}

/**
 * Router biasanya balikin banyak varian ":batch" / ":free" / dst per model
 * dasar yang sama (contoh: "cl/openai/gpt-5" DAN "cl/openai/gpt-5:batch"
 * bersebelahan). Itu bagus buat /models (transparansi penuh, teks polos),
 * tapi bikin combo pilih model ("/model") jadi ratusan baris yang isinya
 * kebanyakan duplikat nyaris identik. Fungsi ini KHUSUS buat combo: satu
 * baris per model dasar (bagian sebelum ":"), ambil kemunculan pertama
 * dari tiap base biar id yang dipilih tetap id yang beneran valid di
 * router. Data aslinya (listModels) tidak diubah / tidak hilang.
 */
export function collapseModelVariants(models) {
  const seenBase = new Set();
  const result = [];
  for (const m of models) {
    const base = m.split(":")[0];
    if (seenBase.has(base)) continue;
    seenBase.add(base);
    result.push(m);
  }
  return result;
}

/**
 * Streaming chat completion. Yields text chunks as they arrive.
 * Falls back to a single full-text yield if the router doesn't support SSE.
 */
export async function* streamChat({ baseUrl, apiKey, model, messages }) {
  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`router error ${res.status}: ${body.slice(0, 300)}`);
  }

  if (!res.body) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    yield text;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      if (!payload) continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // baris SSE yang tidak lengkap, lewati saja
      }
    }
  }
}

export { normalizeBaseUrl };
