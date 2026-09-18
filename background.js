// Captures go through the DevTools Protocol (Page.captureScreenshot),
// which returns the viewport at the display's full physical-pixel
// resolution, instead of chrome.tabs.captureVisibleTab.
//
// This deliberately does NOT use Emulation.setDeviceMetricsOverride to
// force a higher render scale. That override isn't applied correctly to
// cross-origin iframes (like the Street View embed): the iframe gets
// drawn at the scale factor's size, so the panorama and its Google UI
// visibly zoom in to the top-left corner, and Street View re-renders on
// every capture.

const attachedTabs = new Set();

function debuggerAttach(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return;
  await debuggerAttach(tabId);
  attachedTabs.add(tabId);
}

function sendCommand(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

// Keep our tracking in sync if the debugger gets detached some other
// way (tab closed, or the user clicked "Cancel" on Chrome's own
// debugging banner).
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

async function captureFull(tabId) {
  await ensureAttached(tabId);
  const result = await sendCommand(tabId, "Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  return "data:image/png;base64," + result.data;
}

// Cheap low-quality capture, used only to poll whether panorama imagery
// has finished loading. Deliberately uses no `clip`: that makes Chrome
// temporarily zoom the page to the clipped region, which Street View
// reacts to by re-rendering.
async function captureProbe(tabId) {
  await ensureAttached(tabId);
  const result = await sendCommand(tabId, "Page.captureScreenshot", {
    format: "jpeg",
    quality: 30,
    optimizeForSpeed: true,
    captureBeyondViewport: false,
  });
  return "data:image/jpeg;base64," + result.data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "capture" && msg.action !== "probe") return;

  const tabId = sender.tab && sender.tab.id;
  if (!tabId) {
    sendResponse({ error: "No tab id available." });
    return;
  }

  const work = msg.action === "probe" ? captureProbe(tabId) : captureFull(tabId);

  work
    .then((dataUrl) => sendResponse({ dataUrl }))
    .catch((err) => sendResponse({ error: err.message }));
  return true; // keep the message channel open for the async response
});
