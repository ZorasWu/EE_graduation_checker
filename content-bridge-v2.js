const EXTENSION_STORAGE_PREFIX = "ncu-grad:";

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload ?? null;
  }

  return {
    keys: Object.keys(payload),
    createdAt: payload.createdAt ?? null,
    hasSnapshot: Boolean(payload.snapshot),
    snapshotKeys: payload.snapshot ? Object.keys(payload.snapshot) : []
  };
}

function postDebug(token, step, detail, payload) {
  window.postMessage(
    {
      type: "ncu-grad:debug",
      token,
      step,
      detail,
      payload
    },
    "*"
  );
}

async function loadSnapshotFromLocalStorage(token) {
  const key = `${EXTENSION_STORAGE_PREFIX}${token}`;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

function requestSnapshot(token) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "ncu-grad:get",
        token
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response ?? null);
      }
    );
  });
}

window.addEventListener("message", async (event) => {
  const data = event.data;

  if (event.source !== window || !data || data.type !== "ncu-grad:get" || !data.token) {
    return;
  }

  try {
    postDebug(data.token, "bridge:request-received", "Content script received page request.", {
      href: window.location.href
    });

    postDebug(data.token, "bridge:local-read:start", "Reading chrome.storage.local for the requested token.");
    const localPayload = await loadSnapshotFromLocalStorage(data.token);
    postDebug(
      data.token,
      "bridge:local-read:result",
      localPayload ? "Found snapshot in chrome.storage.local." : "No snapshot in chrome.storage.local.",
      summarizePayload(localPayload)
    );

    let result;

    if (localPayload) {
      result = { payload: localPayload, error: null };
    } else {
      postDebug(data.token, "bridge:runtime-request:start", "Requesting snapshot from the extension service worker.");
      result = await requestSnapshot(data.token);
      postDebug(
        data.token,
        "bridge:runtime-request:result",
        result?.error ? "Service worker returned an error response." : "Service worker returned a response.",
        {
          error: result?.error ?? null,
          payload: summarizePayload(result?.payload ?? null)
        }
      );
    }

    postDebug(data.token, "bridge:page-response", "Posting the bridge response back to the page.", {
      error: result?.error ?? null,
      payload: summarizePayload(result?.payload ?? null)
    });

    window.postMessage(
      {
        type: "ncu-grad:data",
        token: data.token,
        payload: result?.payload ?? null,
        error: result?.error ?? "The extension did not return a snapshot response."
      },
      "*"
    );
  } catch (error) {
    postDebug(data.token, "bridge:error", "Content script bridge threw an error.", {
      message: error instanceof Error ? error.message : "Unknown bridge error."
    });
    window.postMessage(
      {
        type: "ncu-grad:data",
        token: data.token,
        error: error instanceof Error ? error.message : "Unknown bridge error."
      },
      "*"
    );
  }
});
