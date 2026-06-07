import { getMergedTrackers } from "../_lib/trackers.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet() {
  const result = await getMergedTrackers();

  if (result.error) {
    return jsonResponse(
      {
        error: result.error,
        failedLists: result.failedLists,
      },
      502,
    );
  }

  return jsonResponse(result);
}
