import { getTokenFromLocation, loadSnapshotViaBridge } from "./report-data.js";
import { renderMessage, renderReport } from "./report-render.js";

export async function bootReportPage({ root, loadSnapshot } = {}) {
  const mount = root ?? document.getElementById("app");
  const token = getTokenFromLocation();

  if (!token) {
    renderMessage(
      mount,
      "No report token",
      "Open this page from the extension after logging into the NCU portal."
    );
    return;
  }

  renderMessage(mount, "Loading report", "Fetching the captured student snapshot from the extension.", "neutral");

  try {
    const payload = await (loadSnapshot ? loadSnapshot(token) : loadSnapshotViaBridge(token));
    renderReport(mount, payload.snapshot);
  } catch (error) {
    renderMessage(mount, "Unable to load report", error.message, "fail");
  }
}
