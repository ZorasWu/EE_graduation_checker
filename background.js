import { PORTAL_URLS, EXTENSION_STORAGE_PREFIX, REPORT_SITE_URL, hasPublishedReportSite } from "./docs/app/app-config.js";
import { createSnapshot } from "./docs/app/snapshot.js";

function buildReportUrl(token) {
  if (hasPublishedReportSite()) {
    const url = new URL(REPORT_SITE_URL);
    url.hash = `token=${token}`;
    return url.toString();
  }

  return chrome.runtime.getURL(`report.html#token=${token}`);
}

async function fetchPortalPage(url, expectedMarker) {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow"
  });

  const html = await response.text();

  if (!response.ok || !html.includes(expectedMarker)) {
    throw new Error(`Unable to load ${url}. Make sure you are already logged into the NCU portal in this browser.`);
  }

  return html;
}

async function captureGraduationSnapshot() {
  const transcriptHtml = await fetchPortalPage(PORTAL_URLS.grade, "學生成績查詢");
  const graduateReportHtml = await fetchPortalPage(PORTAL_URLS.graduateReport, "畢業資格審查表");
  const snapshot = createSnapshot({
    transcriptHtml,
    graduateReportHtml,
    source: "live"
  });
  const token = crypto.randomUUID();

  await chrome.storage.session.set({
    [`${EXTENSION_STORAGE_PREFIX}${token}`]: {
      snapshot,
      createdAt: new Date().toISOString()
    }
  });

  await chrome.tabs.create({
    url: buildReportUrl(token)
  });
}

chrome.action.onClicked.addListener(async () => {
  try {
    await captureGraduationSnapshot();
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Unknown error");
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`report.html?error=${message}`)
    });
  }
});
