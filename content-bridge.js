import { EXTENSION_STORAGE_PREFIX } from "./docs/app/app-config.js";

window.addEventListener("message", async (event) => {
  const data = event.data;

  if (event.source !== window || !data || data.type !== "ncu-grad:get" || !data.token) {
    return;
  }

  const key = `${EXTENSION_STORAGE_PREFIX}${data.token}`;

  try {
    const result = await chrome.storage.session.get(key);
    window.postMessage(
      {
        type: "ncu-grad:data",
        token: data.token,
        payload: result[key] ?? null,
        error: result[key] ? null : "No stored student snapshot was found for this token."
      },
      "*"
    );
  } catch (error) {
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
