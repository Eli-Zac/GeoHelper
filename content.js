(function () {
  const BUTTON_ID = "gg-shot-copy-btn";
  const TOAST_ID = "gg-shot-copy-toast";
  const LOCATE_ID = "gg-shot-locate-btn";
  const OFFSET_TOGGLE_ID = "gg-shot-offset-toggle";
  const AUTOPLAY_ID = "gg-shot-autoplay-btn";

  const PIN_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 21.5C12 21.5 19 15.2 19 9.5C19 5.6 15.9 2.5 12 2.5C8.1 2.5 5 5.6 5 9.5C5 15.2 12 21.5 12 21.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="9.5" r="2.6" stroke="currentColor" stroke-width="1.6"/>' +
    "</svg>";

  const ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M9 3.5C8.6 3.5 8.24 3.71 8.05 4.05L7.4 5.5H4.5C3.4 5.5 2.5 6.4 2.5 7.5V17.5C2.5 18.6 3.4 19.5 4.5 19.5H19.5C20.6 19.5 21.5 18.6 21.5 17.5V7.5C21.5 6.4 20.6 5.5 19.5 5.5H16.6L15.95 4.05C15.76 3.71 15.4 3.5 15 3.5H9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12.5" r="3.6" stroke="currentColor" stroke-width="1.6"/>' +
    "</svg>";

  // OpenGuessr's Street View embed iframe. Usually #panorama-iframe, but
  // falls back to any Street View embed in case the id is missing, and
  // skips the sweep's own helper copies (see createHeadingIframe).
  function findPanoramaIframe() {
    return (
      document.getElementById("panorama-iframe") ||
      document.querySelector('iframe[src*="google.com/maps/embed"]:not([data-gg-helper])')
    );
  }

  // Finds the panorama/street-view element to capture, if one is on
  // screen right now. Checks OpenGuessr's known #panorama-iframe first,
  // then falls back to a size heuristic (largest canvas/iframe filling
  // most of the viewport) for GeoGuessr and any future layout changes.
  // Returns null when there's nothing to screenshot (e.g. on a menu
  // screen), so callers can skip showing the button entirely.
  function findPanoramaElement() {
    const known = findPanoramaIframe();
    if (known) {
      const r = known.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return known;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const candidates = Array.from(document.querySelectorAll("canvas, iframe"));
    let best = null;
    let bestArea = 0;

    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.5 || r.height < vh * 0.5) continue; // too small, likely UI/map thumbnail
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }

    return best;
  }

  // Prefer docking next to the site's own buttons (e.g. OpenGuessr's
  // "Return" button, in .bottom-left-menu > .bar-menu) so we inherit its
  // real button styling exactly instead of guessing colors. Falls back
  // to a floating overlay button only when that bar isn't present but a
  // panorama still is. Shows nothing on menu/results screens where
  // there's no panorama to capture, and removes the button if it stops
  // applying (e.g. leaving a game back to the main menu).
  function injectButton() {
    const nativeContainer = document.querySelector(".bottom-left-menu");
    const hasPanorama = !!findPanoramaElement();
    const existing = document.getElementById(BUTTON_ID);

    if (!nativeContainer && !hasPanorama) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      if (nativeContainer) {
        injectNativeButton(nativeContainer);
      } else {
        injectFloatingButton();
      }
    }

    injectLocateControls();
    injectAutoplayToggle();
  }

  function injectNativeButton(container) {
    const wrapper = document.createElement("div");
    wrapper.className = "bar-menu";

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "standard-button white";
    btn.title = "GeoHelper: copy screenshot to clipboard";
    btn.innerHTML = ICON_SVG + '<span style="margin-left: 6px;">Copy</span>';
    btn.addEventListener("click", handleClick);

    wrapper.appendChild(btn);
    container.appendChild(wrapper);
  }

  // Safe mode: when on, Locate places the pin a random 1–100 km away
  // in a random direction instead of on the exact spot. Persisted in
  // chrome.storage so it survives reloads.
  const OFFSET_STORAGE_KEY = "offsetMode";
  let offsetMode = false;
  chrome.storage.local.get(OFFSET_STORAGE_KEY, (items) => {
    offsetMode = !!items[OFFSET_STORAGE_KEY];
    const toggle = document.getElementById(OFFSET_TOGGLE_ID);
    if (toggle) toggle.checked = offsetMode;
  });

  // Locate only works on OpenGuessr, where locate.js can find the
  // round's coordinates, so it's only offered there.
  // It sits just left of the site's own Guess button (#confirm-button),
  // with the safe mode switch before it.
  function injectLocateControls() {
    if (document.getElementById(LOCATE_ID)) return;
    if (!IS_OPENGUESSR || !findPanoramaElement()) return;
    const guessBtn = document.getElementById("confirm-button");
    if (!guessBtn) return;

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "gg-offset-switch";
    toggleLabel.title = "GeoHelper safe mode: Locate places the pin a random 1–100 km off";
    toggleLabel.innerHTML =
      `<input type="checkbox" id="${OFFSET_TOGGLE_ID}">` +
      '<span class="gg-offset-track"><span class="gg-offset-thumb"></span></span>' +
      "<span>Safe mode</span>";
    const toggle = toggleLabel.querySelector("input");
    toggle.checked = offsetMode;
    toggle.addEventListener("change", () => {
      offsetMode = toggle.checked;
      chrome.storage.local.set({ [OFFSET_STORAGE_KEY]: offsetMode });
    });

    const btn = document.createElement("button");
    btn.id = LOCATE_ID;
    btn.className = "standard-button white";
    btn.title = "GeoHelper: place the guess pin at this location";
    btn.innerHTML = PIN_SVG + '<span style="margin-left: 6px;">Locate</span>';
    btn.addEventListener("click", handleLocate);

    guessBtn.before(toggleLabel, btn);
  }

  const IS_OPENGUESSR = location.hostname.endsWith("openguessr.com");

  // Identifies the current round, for both Street View and custom
  // (Pannellum) panorama rounds: bumped each time the results screen
  // (#next-round) appears.
  let roundSeq = 0;
  let onResults = false;
  setInterval(() => {
    const visible = isVisible(document.getElementById("next-round"));
    if (visible && !onResults) roundSeq++;
    onResults = visible;
  }, 250);

  // Round the pin was last placed in by Locate, so Autoplay can keep
  // that pin instead of placing its own.
  let locatedRound = null;

  // Asks locate.js (running in the page's own JS world) to place the
  // pin, honoring the current Safe mode setting.
  function placePin() {
    const round = roundSeq;
    return new Promise((resolve) => {
      window.addEventListener(
        "geohelper-locate-result",
        (e) => {
          let result;
          try {
            result = JSON.parse(e.detail);
          } catch {
            result = { ok: false, error: "Locate failed." };
          }
          if (result.ok) locatedRound = round;
          resolve(result);
        },
        { once: true }
      );
      window.dispatchEvent(
        new CustomEvent("geohelper-locate", { detail: JSON.stringify({ offset: offsetMode }) })
      );
    });
  }

  async function handleLocate() {
    const result = await placePin();
    if (!result.ok) showToast("GeoHelper: " + result.error);
    else if (result.offsetKm) showToast(`GeoHelper: pin placed (${Math.round(result.offsetKm)} km off)`);
    else showToast("GeoHelper: pin placed");
  }

  function injectFloatingButton() {
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "gg-shot-floating";
    btn.title = "GeoHelper: copy screenshot to clipboard";
    btn.innerHTML = ICON_SVG;
    btn.addEventListener("click", handleClick);
    document.body.appendChild(btn);
  }

  // Known OpenGuessr HUD containers to hide before capturing. The
  // panorama iframe is full-bleed (covers the whole viewport) with
  // these drawn on top as overlays, so cropping to the iframe's rect
  // alone doesn't exclude them — they have to be actually hidden.
  // These are OpenGuessr's own stable class/id names (not the
  // per-build Svelte scoping hash suffixed onto them).
  const KNOWN_OVERLAY_SELECTORS = [
    ".logo",
    ".menu-button-area",
    ".notification-holder",
    "#map-holder",
    "#bottom-bar",
    ".gameplay-ad-area",
    ".end-bottom-area",
  ];

  // Elements to hide right before a capture, restored right after.
  // Tries the known OpenGuessr selectors first; if none match (e.g. on
  // GeoGuessr, whose DOM we haven't inspected), falls back to hiding
  // any top-level fixed/absolute-positioned overlay that isn't the
  // panorama itself or our own button/toast.
  function getOverlayElementsToHide(panoramaEl) {
    const known = KNOWN_OVERLAY_SELECTORS.map((sel) => document.querySelector(sel)).filter(Boolean);
    if (known.length) return known;

    return Array.from(document.body.querySelectorAll("*")).filter((el) => {
      if (el.id === BUTTON_ID || el.id === LOCATE_ID || el.id === TOAST_ID) return false;
      if (panoramaEl && (el === panoramaEl || el.contains(panoramaEl) || panoramaEl.contains(el))) return false;

      const style = getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "absolute") return false;

      // Only the outermost overlay of a nested stack, so we don't hide
      // (and then have to restore) every descendant individually.
      const parent = el.parentElement;
      if (parent) {
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.position === "fixed" || parentStyle.position === "absolute") return false;
      }

      return true;
    });
  }

  function clampRect(rect, vw, vh) {
    return {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.min(rect.width, vw - Math.max(0, rect.left)),
      height: Math.min(rect.height, vh - Math.max(0, rect.top)),
    };
  }

  // Crops the capture to the panorama element found by
  // findPanoramaElement, excluding the score bar, guess map, timer, etc.
  // Falls back to the full viewport if nothing was found.
  function getCaptureRect() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = findPanoramaElement();

    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return clampRect(r, vw, vh);
    }

    return { x: 0, y: 0, width: vw, height: vh };
  }

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("gg-shot-toast-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.remove("gg-shot-toast-visible");
    }, 1500);
  }

  function requestCapture() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "capture" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.dataUrl);
        }
      );
    });
  }

  function requestProbe() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "probe" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.dataUrl);
      });
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Draws the cropped region of `img` (per `rect`, scaled by the
  // image's actual scaleX/scaleY relative to CSS pixels — see
  // getCaptureScale) into a canvas slot starting at `destX`, `destWidth`
  // wide. Shared by the single-shot and 360-sweep capture paths.
  function drawCroppedFrame(ctx, img, rect, scaleX, scaleY, destX, destWidth, destHeight) {
    ctx.drawImage(
      img,
      Math.round(rect.x * scaleX),
      Math.round(rect.y * scaleY),
      destWidth,
      destHeight,
      destX,
      0,
      destWidth,
      destHeight
    );
  }

  // captureVisibleTab's returned image resolution doesn't reliably
  // match window.devicePixelRatio — Chrome's tab-capture pipeline can
  // return CSS-pixel-resolution images on high-DPI displays rather than
  // physical-pixel-resolution ones. Assuming devicePixelRatio caused
  // blurry output (cropping a too-large region, then stretching it up
  // to the expected size). Measuring the real ratio per image avoids
  // that regardless of what Chrome actually does on a given display.
  function getCaptureScale(img) {
    return {
      x: img.naturalWidth / window.innerWidth,
      y: img.naturalHeight / window.innerHeight,
    };
  }

  // Best-effort check for whether the round allows free panning. There's
  // no reliable DOM signal for this, so it just scans the visible page
  // text for common restricted-mode labels (NMPZ, "no pan", "no move").
  // Defaults to true (pannable) when nothing matches.
  function isPannable() {
    const text = document.body.innerText || "";
    return !/\bNMPZ\b/i.test(text) && !/no\s*pan/i.test(text) && !/no\s*move/i.test(text);
  }

  // Only supported for OpenGuessr's simple embed iframe, where the
  // heading is a URL parameter we can step through ourselves. GeoGuessr
  // renders its panorama via the full Maps JS API inside its own app,
  // which we have no hook into, so it always falls back to a single
  // shot at the current heading.
  //
  // This is deliberately back to reloading the iframe rather than
  // simulating input on it: this embed format (maps/embed/v1/streetview)
  // appears to have no interactive drag-pan or keyboard-pan support at
  // all — a synthetic drag had no effect, and a synthetic click (meant
  // only to focus it) instead navigated the panorama forward, which is
  // the one interaction this lightweight embed format does support.
  // Changing the heading URL parameter is the only control surface it
  // actually exposes.
  function supportsSweep(panoramaEl) {
    return !!panoramaEl && panoramaEl === findPanoramaIframe();
  }

  function withHeading(src, heading) {
    return /heading=-?[0-9.]+/.test(src)
      ? src.replace(/heading=-?[0-9.]+/, `heading=${heading}`)
      : src + (src.includes("?") ? "&" : "?") + `heading=${heading}`;
  }

  // Makes a copy of the panorama iframe (same allow/referrerpolicy
  // attributes) pointed at a different heading, pinned exactly over the
  // panorama's rect. Stacking these instead of reloading the real
  // iframe lets every heading load in parallel. They must stay in the
  // viewport and not be hidden while loading: Chrome throttles
  // offscreen/hidden cross-origin iframes, which would stall them.
  //
  // The opaque background matters: an iframe that hasn't painted yet is
  // transparent, so without it the loaded-imagery check would see the
  // real panorama underneath and capture that instead.
  function createHeadingIframe(original, heading, rect, zIndex) {
    const f = original.cloneNode(false);
    f.removeAttribute("id");
    f.removeAttribute("class");
    f.dataset.ggHelper = "";
    f.style.cssText =
      `position:fixed;left:${rect.x}px;top:${rect.y}px;` +
      `width:${rect.width}px;height:${rect.height}px;` +
      `border:0;margin:0;padding:0;background:#000;z-index:${zIndex};`;
    f.loaded = new Promise((resolve) => {
      f.addEventListener("load", resolve, { once: true });
      setTimeout(resolve, 8000); // don't hang forever if "load" never fires
    });
    f.src = withHeading(original.src, heading);
    document.body.appendChild(f);
    return f;
  }

  // Downscales a captured frame and checks whether it's dominated by a
  // single flat color (any color) — the iframe's blank navigation
  // frame, or Street View's "imagery not loaded yet" placeholder —
  // rather than an actual photo. Checking for flat-color dominance in
  // general, whatever the color is, avoids having to hardcode which
  // specific colors mean "still loading": a real street-view photo
  // (sky, road, buildings, foliage) is never 85%+ one color, even with
  // a small loading-spinner icon on an otherwise flat background.
  async function looksLikeLoadedPhoto(dataUrl, rect) {
    const img = await loadImage(dataUrl);
    const scale = getCaptureScale(img);
    const w = 40;
    const h = 22;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    cx.drawImage(
      img,
      rect.x * scale.x,
      rect.y * scale.y,
      rect.width * scale.x,
      rect.height * scale.y,
      0,
      0,
      w,
      h
    );

    const { data } = cx.getImageData(0, 0, w, h);
    const n = w * h;
    const buckets = new Map();
    const BUCKET_SIZE = 24; // quantize so near-identical colors count together

    for (let i = 0; i < data.length; i += 4) {
      const rq = Math.round(data[i] / BUCKET_SIZE);
      const gq = Math.round(data[i + 1] / BUCKET_SIZE);
      const bq = Math.round(data[i + 2] / BUCKET_SIZE);
      const key = rq + "," + gq + "," + bq;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const dominantCount = Math.max(...buckets.values());
    return dominantCount / n < 0.85; // a flat loading screen is ~all one color; a photo isn't
  }

  // Waits for `helper` to finish navigating, then polls cheap low-quality
  // probes of `rect` until it looks like loaded imagery rather than a
  // blank frame or Street View's grey/black "still loading" placeholder,
  // then gives tiles a moment to sharpen. Gives up after a timeout so a
  // slow/failed load can't hang the sweep forever.
  async function waitForLoadedImagery(helper, rect, maxWaitMs = 8000, pollIntervalMs = 150) {
    await helper.loaded;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (await looksLikeLoadedPhoto(await requestProbe(), rect)) {
        await sleep(300);
        return;
      }
      await sleep(pollIntervalMs);
    }
  }

  // Captures the panorama at STEPS evenly spaced headings and returns
  // the frames (see stitchFrames). The first heading is the
  // live iframe exactly as it is now (no reload). The remaining
  // headings are loaded simultaneously in stacked copies of the iframe,
  // so the whole sweep costs roughly one load instead of one per step,
  // and the real iframe is never touched so nothing needs restoring.
  async function capture360Sweep(iframe, rect) {
    const headingMatch = iframe.src.match(/heading=(-?[0-9.]+)/);
    const baseHeading = headingMatch ? parseFloat(headingMatch[1]) : 0;
    const STEPS = 4;
    const STEP_DEG = 360 / STEPS;
    const Z_BASE = 999900; // above the page, below our toast

    const frames = [];
    const helpers = [];

    try {
      showToast(`GeoHelper: capturing sweep (1/${STEPS})`);
      frames.push(await captureSingleFrame(rect));

      // Earlier headings sit on top; each is hidden once captured to
      // reveal the next (already loading/loaded) one beneath it.
      for (let i = 1; i < STEPS; i++) {
        const heading = ((baseHeading + i * STEP_DEG) % 360 + 360) % 360;
        helpers.push(createHeadingIframe(iframe, heading, rect, Z_BASE + (STEPS - i)));
      }

      for (let i = 0; i < helpers.length; i++) {
        showToast(`GeoHelper: capturing sweep (${i + 2}/${STEPS})`);
        await waitForLoadedImagery(helpers[i], rect);
        frames.push(await captureSingleFrame(rect));
        helpers[i].style.visibility = "hidden";
      }
    } finally {
      helpers.forEach((f) => f.remove());
    }

    return frames;
  }

  // Lays sweep frames side by side into one wide strip.
  function stitchFrames(frames) {
    const frameW = frames[0].width;
    const frameH = frames[0].height;
    const canvas = document.createElement("canvas");
    canvas.width = frameW * frames.length;
    canvas.height = frameH;
    const ctx = canvas.getContext("2d");
    frames.forEach((f, i) => ctx.drawImage(f, i * frameW, 0));
    return canvas;
  }

  async function captureSingleFrame(rect) {
    // Keep the progress toast out of the shot.
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.style.visibility = "hidden";
    let dataUrl;
    try {
      dataUrl = await requestCapture();
    } finally {
      if (toast) toast.style.visibility = "";
    }
    const img = await loadImage(dataUrl);
    const scale = getCaptureScale(img);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width * scale.x);
    canvas.height = Math.round(rect.height * scale.y);
    const ctx = canvas.getContext("2d");
    drawCroppedFrame(ctx, img, rect, scale.x, scale.y, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function handleClick() {
    const btn = document.getElementById(BUTTON_ID);
    btn.disabled = true;

    const panoramaEl = findPanoramaElement();
    const overlays = getOverlayElementsToHide(panoramaEl);
    const prevVisibility = overlays.map((el) => el.style.visibility);

    // Hide our own button plus every HUD overlay so they don't appear
    // in the screenshot(s), then wait briefly for the DOM to repaint
    // before capturing.
    const locateBtn = document.getElementById(LOCATE_ID);
    btn.style.visibility = "hidden";
    if (locateBtn) locateBtn.style.visibility = "hidden";
    overlays.forEach((el) => {
      el.style.visibility = "hidden";
    });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 60));

    let frames;
    let captureError;
    try {
      const rect = getCaptureRect();
      const doSweep = supportsSweep(panoramaEl) && isPannable();

      frames = doSweep ? await capture360Sweep(panoramaEl, rect) : [await captureSingleFrame(rect)];
    } catch (err) {
      captureError = err;
    } finally {
      // Capturing is done, so bring the game UI back right away rather
      // than leaving it hidden through the (slow, for a wide sweep)
      // stitch + PNG encode + clipboard write below. The button stays
      // disabled with a spinner until that finishes.
      btn.style.visibility = "visible";
      if (locateBtn) locateBtn.style.visibility = "visible";
      btn.classList.add("gg-shot-busy");
      overlays.forEach((el, i) => {
        el.style.visibility = prevVisibility[i];
      });
    }

    try {
      if (captureError) throw captureError;

      // Let the restored UI paint before the encode ties up the thread.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

      const canvas = frames.length > 1 ? stitchFrames(frames) : frames[0];
      // Handing ClipboardItem a promise lets the clipboard write start
      // immediately while the PNG is still encoding.
      const blob = new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

      showToast("GeoHelper: copied to clipboard");
    } catch (err) {
      console.error("GeoHelper:", err);
      showToast("GeoHelper: copy failed — see console");
    } finally {
      btn.classList.remove("gg-shot-busy");
      btn.disabled = false;
    }
  }

  // ---- Autoplay ------------------------------------
  //
  // When on, each round: wait a random GUESS_DELAY, place the pin via
  // Locate (respecting Safe mode) unless Locate already placed one this
  // round, press Guess; on
  // the results screen wait a random CONTINUE_DELAY and press Continue
  // (#next-round) to start the next round.
  const GUESS_DELAY_MS = [5000, 15000];
  const CONTINUE_DELAY_MS = [2000, 4000];

  const autoplay = {
    on: false,
    timer: null,
    deadline: 0,
    handledRound: null, // roundSeq of the round we've already scheduled a guess for
    pending: null, // "guess" | "continue" while a timer is running
  };

  function randomBetween([min, max]) {
    return min + Math.random() * (max - min);
  }

  // Not offsetParent: that's null for position:fixed elements even when
  // they're plainly on screen.
  function isVisible(el) {
    return !!el && el.checkVisibility({ visibilityProperty: true });
  }

  function injectAutoplayToggle() {
    if (document.getElementById(AUTOPLAY_ID)) return;
    if (!IS_OPENGUESSR || !findPanoramaElement()) return;
    const nav = document.querySelector(".menu-button-area");
    const menuBtn = nav && nav.querySelector(".menu-button");
    if (!menuBtn) return;

    const btn = document.createElement("button");
    btn.id = AUTOPLAY_ID;
    btn.className = "standard-button white gg-autoplay";
    btn.title = "GeoHelper: automatically guess and continue";
    btn.setAttribute("aria-pressed", String(autoplay.on));
    btn.innerHTML =
      '<span class="gg-offset-track"><span class="gg-offset-thumb"></span></span>' +
      '<span class="gg-autoplay-label">Autoplay</span>';
    btn.addEventListener("click", () => setAutoplay(!autoplay.on));
    menuBtn.before(btn);
  }

  function renderAutoplay() {
    const btn = document.getElementById(AUTOPLAY_ID);
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(autoplay.on));
    const label = btn.querySelector(".gg-autoplay-label");
    const secs = Math.ceil((autoplay.deadline - Date.now()) / 1000);
    label.textContent = autoplay.on && autoplay.pending && secs > 0 ? `Autoplay ${secs}s` : "Autoplay";
  }

  function setAutoplay(on) {
    autoplay.on = on;
    clearTimeout(autoplay.timer);
    autoplay.timer = null;
    autoplay.pending = null;
    autoplay.handledRound = null;
    renderAutoplay();
  }

  function schedule(kind, delayRange, action) {
    autoplay.pending = kind;
    const delay = randomBetween(delayRange);
    autoplay.deadline = Date.now() + delay;
    autoplay.timer = setTimeout(async () => {
      autoplay.timer = null;
      try {
        if (autoplay.on) await action();
      } finally {
        autoplay.pending = null;
        renderAutoplay();
      }
    }, delay);
  }

  async function autoGuess() {
    // Keep a pin the user already placed with Locate this round;
    // otherwise place one the same way Locate would (Safe mode included).
    if (locatedRound !== roundSeq) {
      const result = await placePin();
      if (!result.ok) {
        showToast("GeoHelper: Autoplay stopped — " + result.error);
        setAutoplay(false);
        return;
      }
    }
    await new Promise((r) => setTimeout(r, randomBetween([400, 1200])));
    const guessBtn = document.getElementById("confirm-button");
    if (autoplay.on && isVisible(guessBtn)) guessBtn.click();
  }

  function isContinueReady(btn) {
    return (
      !btn.disabled &&
      btn.getAttribute("aria-disabled") !== "true" &&
      !btn.classList.contains("disabled") &&
      !/wait/i.test(btn.textContent)
    );
  }

  // Polled a couple of times a second while Autoplay is on; decides
  // which step (if any) comes next based on what's on screen.
  function autoplayTick() {
    if (!autoplay.on) return;
    renderAutoplay();
    if (autoplay.pending) return;

    const nextRound = document.getElementById("next-round");
    if (isVisible(nextRound)) {
      // OpenGuessr locks Continue behind a "Wait 5s..." countdown and
      // ignores clicks until it ends, so only start our own delay once
      // it's actually clickable.
      if (!isContinueReady(nextRound)) return;
      schedule("continue", CONTINUE_DELAY_MS, async () => {
        const btn = document.getElementById("next-round");
        if (isVisible(btn) && isContinueReady(btn)) btn.click();
      });
      return;
    }

    const guessBtn = document.getElementById("confirm-button");
    if (findPanoramaElement() && isVisible(guessBtn) && autoplay.handledRound !== roundSeq) {
      autoplay.handledRound = roundSeq;
      schedule("guess", GUESS_DELAY_MS, autoGuess);
    }
  }

  setInterval(autoplayTick, 500);

  injectButton();

  // Both sites are single-page apps; the button can get wiped out on
  // route changes, so keep re-adding it if it disappears.
  new MutationObserver(injectButton).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
