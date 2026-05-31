import { EXTENSION_STORAGE_PREFIX } from "./app-config.js";

export function getTokenFromLocation(locationObject = window.location) {
  const hash = new URLSearchParams((locationObject.hash || "").replace(/^#/, ""));
  const search = new URLSearchParams(locationObject.search || "");
  return hash.get("token") || search.get("token") || "";
}

export async function loadSnapshotFromExtensionStorage(token) {
  if (!globalThis.chrome?.storage?.session) {
    throw new Error("Chrome session storage is not available in this page.");
  }

  const key = `${EXTENSION_STORAGE_PREFIX}${token}`;
  const result = await chrome.storage.session.get(key);
  const payload = result[key];

  if (!payload) {
    throw new Error("No captured student data was found for this report token.");
  }

  return payload;
}

export function loadSnapshotViaBridge(token, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for extension data. Open this page from the extension after login."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event) {
      const data = event.data;
      if (!data || data.type !== "ncu-grad:data" || data.token !== token) {
        return;
      }

      cleanup();

      if (data.error) {
        reject(new Error(data.error));
        return;
      }

      resolve(data.payload);
    }

    window.addEventListener("message", handleMessage);
    window.postMessage({ type: "ncu-grad:get", token }, "*");
  });
}
