const output = document.getElementById("trackers-output");
const statusPill = document.getElementById("status-pill");
const countPill = document.getElementById("count-pill");
const rawPill = document.getElementById("raw-pill");
const duplicatesPill = document.getElementById("duplicates-pill");
const listsPill = document.getElementById("lists-pill");
const feedback = document.getElementById("feedback");
const warnings = document.getElementById("warnings");
const copyButton = document.getElementById("copy-button");
const selectButton = document.getElementById("select-button");
const refreshButton = document.getElementById("refresh-button");
const copyUrlButton = document.getElementById("copy-url-button");

const TRACKERS_LIST_URL = "https://trackers.carlinitools.com/trackers.txt";

let latestText = "";
let trackersListUrl = TRACKERS_LIST_URL;

function setStatus(message, variant = "default") {
  statusPill.textContent = message;
  statusPill.classList.remove("status-pill--ok", "status-pill--error");

  if (variant === "ok") {
    statusPill.classList.add("status-pill--ok");
  }

  if (variant === "error") {
    statusPill.classList.add("status-pill--error");
  }
}

function setFeedback(message, variant = "default") {
  feedback.textContent = message;
  feedback.classList.remove("feedback--success", "feedback--error");

  if (variant === "success") {
    feedback.classList.add("feedback--success");
  }

  if (variant === "error") {
    feedback.classList.add("feedback--error");
  }
}

function setControlsEnabled(enabled) {
  copyButton.disabled = !enabled;
  selectButton.disabled = !enabled;
}

function formatWarnings(failedLists) {
  if (!failedLists?.length) {
    warnings.hidden = true;
    warnings.textContent = "";
    return;
  }

  const details = failedLists.map((item) => `${item.file}: ${item.error}`).join(" · ");
  warnings.hidden = false;
  warnings.textContent = `No se pudieron descargar ${failedLists.length} lista(s). El resultado incluye las listas disponibles. ${details}`;
}

async function loadTrackers() {
  setStatus("Descargando listas…");
  setFeedback("");
  setControlsEnabled(false);
  refreshButton.disabled = true;
  output.value = "";
  latestText = "";
  formatWarnings([]);

  try {
    const response = await fetch("/api/trackers", {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "No se pudieron obtener las listas.");
    }

    latestText = payload.text || "";
    output.value = latestText;

    if (payload.trackersListUrl) {
      trackersListUrl = payload.trackersListUrl;
    }

    countPill.textContent = `${payload.count} trackers únicos`;
    rawPill.textContent = `${payload.rawTotal} entradas en listas`;
    duplicatesPill.textContent = `${payload.duplicatesRemoved} duplicados omitidos`;
    listsPill.textContent = `${payload.listsProcessed} listas procesadas`;
    formatWarnings(payload.listsFailed);

    if (!latestText) {
      setStatus("Sin trackers disponibles", "error");
      setFeedback("No se encontraron trackers en las listas descargadas.", "error");
      return;
    }

    setStatus("Listas unificadas", "ok");
    setFeedback(
      `Se descargaron ${payload.rawTotal} entradas repartidas en ${payload.listsProcessed} listas. El resultado conserva ${payload.count} trackers únicos y omite ${payload.duplicatesRemoved} duplicados entre listas.`,
      "success",
    );
    setControlsEnabled(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al cargar las listas.";
    setStatus("Error al cargar", "error");
    setFeedback(message, "error");
    countPill.textContent = "0 trackers únicos";
    rawPill.textContent = "0 entradas en listas";
    duplicatesPill.textContent = "0 duplicados omitidos";
    listsPill.textContent = "0 listas procesadas";
  } finally {
    refreshButton.disabled = false;
  }
}

async function copyTrackers() {
  if (!latestText) {
    setFeedback("No hay contenido para copiar.", "error");
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(latestText);
    } else {
      output.focus();
      output.select();
      const copied = document.execCommand("copy");
      if (!copied) {
        throw new Error("El navegador no permitió copiar el contenido.");
      }
    }

    setFeedback("Trackers copiados al portapapeles.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo copiar al portapapeles.";
    setFeedback(message, "error");
  }
}

function selectAllTrackers() {
  if (!latestText) {
    return;
  }

  output.focus();
  output.select();
  setFeedback("Contenido seleccionado. También puedes copiarlo con el botón principal.", "success");
}

async function copyTrackersUrl() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trackersListUrl);
    } else {
      throw new Error("El navegador no permitió copiar la URL.");
    }

    setFeedback(`URL copiada: ${trackersListUrl}. Pégala en qBittorrent → Opciones → BitTorrent.`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo copiar la URL.";
    setFeedback(message, "error");
  }
}

copyButton.addEventListener("click", copyTrackers);
selectButton.addEventListener("click", selectAllTrackers);
refreshButton.addEventListener("click", loadTrackers);
copyUrlButton.addEventListener("click", copyTrackersUrl);

loadTrackers();
