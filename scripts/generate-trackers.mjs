import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

async function getMergedTrackers() {
  const settled = await Promise.allSettled(
    TRACKER_LIST_FILES.map((fileName) => fetchList(fileName)),
  );

  const successfulLists = [];
  const failedLists = [];

  settled.forEach((result, index) => {
    const fileName = TRACKER_LIST_FILES[index];

    if (result.status === "fulfilled") {
      successfulLists.push(result.value);
      return;
    }

    failedLists.push({
      file: fileName,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  if (successfulLists.length === 0) {
    throw new Error("No se pudo descargar ninguna lista de trackers.");
  }

  const rawTotal = successfulLists.reduce((sum, trackers) => sum + trackers.length, 0);
  const trackers = mergeTrackers(successfulLists);

  return {
    trackers,
    text: trackers.join("\n"),
    count: trackers.length,
    rawTotal,
    duplicatesRemoved: rawTotal - trackers.length,
    listsProcessed: successfulLists.length,
    listsFailed: failedLists,
    updatedAt: new Date().toISOString(),
  };
}

const outputPath = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "trackers.txt");

const result = await getMergedTrackers();
const body = result.trackers.length ? `${result.text}\n` : "";

writeFileSync(outputPath, body, "utf8");

console.log(`Generado ${outputPath}`);
console.log(`${result.count} trackers únicos (${result.duplicatesRemoved} duplicados omitidos)`);
console.log(`${result.listsProcessed}/${TRACKER_LIST_FILES.length} listas procesadas`);
console.log(`Actualizado: ${result.updatedAt}`);

if (result.listsFailed.length) {
  console.warn("Listas con error:");
  for (const item of result.listsFailed) {
    console.warn(`  - ${item.file}: ${item.error}`);
  }
}
