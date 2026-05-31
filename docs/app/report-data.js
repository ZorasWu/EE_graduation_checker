import { EXTENSION_STORAGE_PREFIX } from "./app-config.js";

function emitProgress(onProgress, step, detail, payload) {
  if (typeof onProgress !== "function") {
    return;
  }

  onProgress({
    time: new Date().toISOString(),
    step,
    detail,
    payload
  });
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload ?? null;
  }

  return {
    keys: Object.keys(payload),
    createdAt: payload.createdAt ?? null,
    hasSnapshot: Boolean(payload.snapshot)
  };
}

export function getTokenFromLocation(locationObject = window.location) {
  const hash = new URLSearchParams((locationObject.hash || "").replace(/^#/, ""));
  const search = new URLSearchParams(locationObject.search || "");
  return hash.get("token") || search.get("token") || "";
}

export async function loadSnapshotFromExtensionStorage(token) {
  if (!globalThis.chrome?.storage) {
    throw new Error("Chrome extension storage is not available in this page.");
  }

  const key = `${EXTENSION_STORAGE_PREFIX}${token}`;
  const sessionResult = chrome.storage.session ? await chrome.storage.session.get(key) : {};
  const localResult = chrome.storage.local ? await chrome.storage.local.get(key) : {};
  const payload = sessionResult[key] ?? localResult[key];

  if (!payload) {
    throw new Error("No captured student data was found for this report token.");
  }

  return payload;
}

export function loadSnapshotViaBridge(token, timeoutMs = 4000, onProgress) {
  return new Promise((resolve, reject) => {
    emitProgress(onProgress, "page:init", "Preparing hosted-page bridge request.", {
      token,
      timeoutMs
    });

    const timer = globalThis.setTimeout(() => {
      cleanup();
      emitProgress(onProgress, "page:timeout", "No extension bridge response arrived before timeout.", {
        timeoutMs
      });
      reject(new Error("Timed out waiting for extension data. Open this page from the extension after login."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event) {
      const data = event.data;
      if (!data || data.token !== token) {
        return;
      }

      if (data.type === "ncu-grad:debug") {
        emitProgress(onProgress, data.step || "bridge:debug", data.detail || "Debug event received.", data.payload);
        return;
      }

      if (data.type !== "ncu-grad:data") {
        return;
      }

      emitProgress(
        onProgress,
        "page:response",
        data.error ? "Received error response from extension bridge." : "Received snapshot response from extension bridge.",
        {
          error: data.error ?? null,
          payload: summarizePayload(data.payload)
        }
      );

      cleanup();

      if (data.error) {
        reject(new Error(data.error));
        return;
      }

      resolve(data.payload);
    }

    window.addEventListener("message", handleMessage);
    emitProgress(onProgress, "page:listener", "Attached window message listener for bridge responses.");
    window.postMessage({ type: "ncu-grad:get", token }, "*");
    emitProgress(onProgress, "page:request", "Posted ncu-grad:get request to the page window.", {
      token
    });
  });
}
