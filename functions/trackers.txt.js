import { getMergedTrackers } from "./_lib/trackers.js";

const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

export async function onRequestGet() {
  const result = await getMergedTrackers();

  if (result.error) {
    return new Response(`${result.error}\n`, {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const body = result.trackers.length ? `${result.text}\n` : "";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
