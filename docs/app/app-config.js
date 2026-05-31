export const PORTAL_URLS = {
  access: "https://portal.ncu.edu.tw/",
  grade: "https://cis.ncu.edu.tw/iNCU/academic/score/transcriptQuery",
  graduateReport: "https://cis.ncu.edu.tw/iNCU/academic/graduate/graduateReport"
};

// Set this after GitHub Pages is live, for example:
// https://YOUR-ACCOUNT.github.io/YOUR-REPO/
export const REPORT_SITE_URL = "";

export const EXTENSION_STORAGE_PREFIX = "ncu-grad:";

export function hasPublishedReportSite() {
  return typeof REPORT_SITE_URL === "string" && REPORT_SITE_URL.startsWith("http");
}
