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

const UPDATE_CHECK_REPO = "Eli-Zac/GeoHelper";

// Numeric per-segment compare of two dot-separated version strings
// (Chrome extension versions: 1-4 non-negative integers). Missing
// trailing segments count as 0, so "1.2" == "1.2.0".
function compareVersions(a, b) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function checkForUpdates() {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_CHECK_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);

  const data = await res.json();
  const latestVersion = String(data.tag_name || "").replace(/^v/, "");
  if (!latestVersion) throw new Error("No release found.");

  const currentVersion = chrome.runtime.getManifest().version;
  return {
    currentVersion,
    latestVersion,
    htmlUrl: data.html_url,
    isNewer: compareVersions(latestVersion, currentVersion) > 0,
  };
}

// Chrome injects an "update_url" into the manifest of every extension it
// installed itself (the Web Store's own CRX endpoint). A "Load unpacked"
// copy has no such field — and no update channel — so this is how we tell
// whether Chrome can actually install an update for us or whether all we
// can do is point at the release page.
function isStoreManaged() {
  return Boolean(chrome.runtime.getManifest().update_url);
}

// Normalizes the two callback shapes this API has had: MV2 passed
// (status, details), MV3 passes a single { status, version } object.
// Reading whichever arrived keeps this working across Chrome versions.
function requestUpdateCheck() {
  return new Promise((resolve, reject) => {
    chrome.runtime.requestUpdateCheck((...args) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const [first, second] = args;
      if (first && typeof first === "object") {
        resolve({ status: first.status, version: first.version || "" });
        return;
      }
      resolve({ status: first, version: (second && second.version) || "" });
    });
  });
}

// Deliberately no chrome.runtime.onUpdateAvailable listener: registering one
// makes Chrome hold the update back until we call reload() ourselves, and
// reloading unprompted would kill an in-progress Autoplay run mid-round.
// Without a listener Chrome installs the new version on its own once the
// extension goes idle, and the button below forces it to happen now.
async function installUpdate() {
  const currentVersion = chrome.runtime.getManifest().version;

  if (!isStoreManaged()) {
    const info = await checkForUpdates();
    return { outcome: "manual", ...info };
  }

  const { status, version } = await requestUpdateCheck();
  if (status === "throttled") return { outcome: "throttled", currentVersion };
  if (status !== "update_available") return { outcome: "up_to_date", currentVersion };
  return { outcome: "updating", version, currentVersion };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "updateNow") {
    installUpdate()
      .then((result) => {
        sendResponse(result);
        // reload() tears down this worker along with every content script,
        // so it has to come after the response is already on its way out.
        if (result.outcome === "updating") {
          setTimeout(() => chrome.runtime.reload(), 250);
        }
      })
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep the message channel open for the async response
  }

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
