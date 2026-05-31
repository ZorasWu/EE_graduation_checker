import { getTokenFromLocation, loadSnapshotViaBridge } from "./report-data.js";
import { renderMessage, renderReport } from "./report-render.js";

export async function bootReportPage({ root, loadSnapshot } = {}) {
  const mount = root ?? document.getElementById("app");
  const token = getTokenFromLocation();
  const diagnostics = [];

  function pushDiagnostic(entry) {
    diagnostics.push(entry);
  }

  function renderStatus(title, body, tone = "neutral") {
    renderMessage(mount, title, body, tone, diagnostics);
  }

  if (!token) {
    pushDiagnostic({
      step: "page:token",
      detail: "No report token was found in the URL hash or query string."
    });
    renderStatus("No report token", "Open this page from the extension after logging into the NCU portal.");
    return;
  }

  pushDiagnostic({
    step: "page:token",
    detail: "Resolved report token from the current URL.",
    payload: { token }
  });
  renderStatus("Loading report", "Fetching the captured student snapshot from the extension.", "neutral");

  try {
    const progressHandler = (entry) => {
      pushDiagnostic(entry);
      renderStatus("Loading report", "Fetching the captured student snapshot from the extension.", "neutral");
    };
    const payload = await (loadSnapshot ? loadSnapshot(token, progressHandler) : loadSnapshotViaBridge(token, 4000, progressHandler));
    pushDiagnostic({
      step: "page:success",
      detail: "Snapshot loaded successfully.",
      payload: {
        createdAt: payload.createdAt ?? null,
        hasSnapshot: Boolean(payload.snapshot)
      }
    });
    renderReport(mount, payload.snapshot);
  } catch (error) {
    pushDiagnostic({
      step: "page:error",
      detail: "Snapshot load failed.",
      payload: {
        message: error.message
      }
    });
    renderStatus("Unable to load report", error.message, "fail");
  }
}
