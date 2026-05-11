const TRACKER_LIST_FILES = [
  "trackers_best.txt",
  "trackers_all.txt",
  "trackers_all_udp.txt",
  "trackers_all_http.txt",
  "trackers_all_https.txt",
  "trackers_all_ws.txt",
  "trackers_all_i2p.txt",
  "trackers_all_yggdrasil.txt",
  "trackers_best_ip.txt",
  "trackers_all_ip.txt",
  "trackers_all_yggdrasil_ip.txt",
];

const SOURCE_URLS = [
  "https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master",
  "https://raw.githubusercontent.com/ngosang/trackerslist/master",
];

const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const USER_AGENT = "trackers-merger/1.0 (+https://github.com/ngosang/trackerslist)";

function parseTrackers(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function fetchList(fileName) {
  let lastError = null;

  for (const baseUrl of SOURCE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/${fileName}`, {
        headers: {
          Accept: "text/plain",
          "User-Agent": USER_AGENT,
        },
        cf: {
          cacheTtl: 3600,
          cacheEverything: true,
        },
      });

      if (!response.ok) {
        lastError = new Error(`${fileName}: HTTP ${response.status} (${baseUrl})`);
        continue;
      }

      return parseTrackers(await response.text());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`No se pudo descargar ${fileName}`);
}

function mergeTrackers(lists) {
  const seen = new Set();
  const merged = [];

  for (const trackers of lists) {
    for (const tracker of trackers) {
      if (seen.has(tracker)) {
        continue;
      }

      seen.add(tracker);
      merged.push(tracker);
    }
  }

  return merged;
}

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
  const settled = await Promise.allSettled(
    TRACKER_LIST_FILES.map((fileName) => fetchList(fileName)),
  );

  const successfulLists = [];
  const failedLists = [];
  const listStats = [];

  settled.forEach((result, index) => {
    const fileName = TRACKER_LIST_FILES[index];

    if (result.status === "fulfilled") {
      successfulLists.push(result.value);
      listStats.push({
        file: fileName,
        count: result.value.length,
      });
      return;
    }

    failedLists.push({
      file: fileName,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
    listStats.push({
      file: fileName,
      count: 0,
      failed: true,
    });
  });

  if (successfulLists.length === 0) {
    return jsonResponse(
      {
        error: "No se pudo descargar ninguna lista de trackers.",
        failedLists,
      },
      502,
    );
  }

  const rawTotal = successfulLists.reduce((sum, trackers) => sum + trackers.length, 0);
  const trackers = mergeTrackers(successfulLists);
  const text = trackers.join("\n");
  const duplicatesRemoved = rawTotal - trackers.length;

  return jsonResponse({
    text,
    count: trackers.length,
    rawTotal,
    duplicatesRemoved,
    listStats,
    listsProcessed: TRACKER_LIST_FILES.length - failedLists.length,
    listsFailed: failedLists,
    source: "https://github.com/ngosang/trackerslist",
    updatedAt: new Date().toISOString(),
  });
}
