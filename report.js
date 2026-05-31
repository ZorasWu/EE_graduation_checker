import { bootReportPage } from "./docs/app/report-page.js";
import { loadSnapshotFromExtensionStorage } from "./docs/app/report-data.js";
import { renderMessage } from "./docs/app/report-render.js";

const mount = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const errorMessage = params.get("error");

if (errorMessage) {
  renderMessage(mount, "Unable to capture data", decodeURIComponent(errorMessage), "fail");
} else {
  bootReportPage({
    root: mount,
    loadSnapshot: loadSnapshotFromExtensionStorage
  });
}
