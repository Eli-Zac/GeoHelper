// Runs in the page's own JavaScript world (manifest "world": "MAIN"),
// not the extension's isolated content-script world, because it needs
// OpenGuessr's live Leaflet map object. content.js asks it to act via a
// "geohelper-locate" DOM event and gets the outcome back as
// "geohelper-locate-result" (both details are JSON strings, since only
// primitives cross between the two worlds reliably).
//
// OpenGuessr doesn't expose its map instance anywhere, so we grab it by
// briefly wrapping L.Map.prototype._fireDOMEvent and nudging the map
// container with a synthetic mousemove. Leaflet routes every DOM event
// on the map through that method (looked up on the prototype at call
// time), so the wrapper sees the map as `this`. Hooking the more obvious
// Evented.fire doesn't work reliably: Leaflet only calls fire() for a
// mousemove when something happens to be listening for it.
(function () {
  let map = null;

  // Custom-panorama rounds (rendered with Pannellum, no Street View
  // iframe) don't expose the location anywhere on the page. But at the
  // start of a game OpenGuessr fetches every round's location at once,
  // as {"locations": [[lat, lng, {heading}], ...], ...}. We catch that
  // response (this script runs at document_start so the hooks are in
  // place first) and track which round we're on by counting results
  // screens (#next-round appearing) since it arrived.
  let gameLocations = null;
  let roundIndex = 0;

  function captureLocations(data) {
    const locs = data && data.locations;
    if (!Array.isArray(locs) || !locs.length) return;
    if (!locs.every((l) => Array.isArray(l) && Number.isFinite(l[0]) && Number.isFinite(l[1]))) return;
    gameLocations = locs.map((l) => [l[0], l[1]]);
    roundIndex = 0;
  }

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    p.then((res) => {
      if ((res.headers.get("content-type") || "").includes("json")) {
        res.clone().json().then(captureLocations, () => {});
      }
    }, () => {});
    return p;
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (this.responseType === "json") captureLocations(this.response);
        else if (this.responseType === "" || this.responseType === "text") {
          const t = this.responseText;
          if (t && t.includes('"locations"')) captureLocations(JSON.parse(t));
        }
      } catch {}
    });
    return origSend.apply(this, args);
  };

  let onResults = false;
  setInterval(() => {
    const btn = document.getElementById("next-round");
    const visible = !!btn && btn.checkVisibility({ visibilityProperty: true });
    if (visible && !onResults) roundIndex++;
    onResults = visible;
  }, 250);

  function findMap() {
    if (map && map._container && map._container.isConnected) return Promise.resolve(map);
    map = null;

    const L = window.L;
    const container = document.querySelector(".leaflet-container");
    if (!L || !L.Map || !container) return Promise.resolve(null);

    return new Promise((resolve) => {
      const proto = L.Map.prototype;
      const orig = proto._fireDOMEvent;
      const done = (m) => {
        proto._fireDOMEvent = orig;
        clearTimeout(timer);
        resolve(m);
      };
      proto._fireDOMEvent = function (...args) {
        done(this);
        return orig.apply(this, args);
      };
      const timer = setTimeout(() => done(null), 500);

      const r = container.getBoundingClientRect();
      container.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
        })
      );
    }).then((m) => (map = m));
  }

  // Point `km` away from lat/lng along compass `bearingDeg`, on a
  // spherical Earth (great-circle destination formula).
  function destination(lat, lng, km, bearingDeg) {
    const R = 6371;
    const rad = Math.PI / 180;
    const d = km / R;
    const b = bearingDeg * rad;
    const p1 = lat * rad;
    const l1 = lng * rad;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 / rad, ((((l2 / rad) + 540) % 360) - 180)];
  }

  // The embed URL is built by OpenGuessr as
  // `...streetview?location=<lat>,<lng>&...[&pano=<id>]`. Some rounds
  // (e.g. certain custom maps / competition rounds) only have a
  // panorama ID, so `location` comes through as something like
  // "null,null" and Google resolves the view from `pano` alone. In that
  // case, look the pano ID up the same way OpenGuessr itself does:
  // Google's photometa endpoint, which returns the pano's coordinates.
  async function getRoundLocation(src) {
    let params;
    try {
      params = new URL(src).searchParams;
    } catch {
      return null;
    }

    const [lat, lng] = (params.get("location") || "").split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return [lat, lng];

    const pano = params.get("pano");
    if (!pano) return null;
    try {
      const res = await fetch(
        "https://www.google.com/maps/photometa/v1?pb=!1m1!1smaps_sv.tactile!3m3!1m2!1e2!2s" +
          encodeURIComponent(pano) +
          "!4m6!1e1!1e4!5m1!1e2!6m1!1e2"
      );
      const data = JSON.parse((await res.text()).slice(5)); // strip )]}' prefix
      const coords = data[1][0][5][0][1][0]; // [null, null, lat, lng]
      if (Number.isFinite(coords[2]) && Number.isFinite(coords[3])) return [coords[2], coords[3]];
    } catch (err) {
      console.warn("GeoHelper locate: pano lookup failed:", err);
    }
    return null;
  }

  function reply(result) {
    window.dispatchEvent(new CustomEvent("geohelper-locate-result", { detail: JSON.stringify(result) }));
  }

  window.addEventListener("geohelper-locate", async (e) => {
    try {
      let opts = {};
      try {
        opts = JSON.parse(e.detail) || {};
      } catch {}

      // Same lookup as content.js's findPanoramaIframe.
      const iframe =
        document.getElementById("panorama-iframe") ||
        document.querySelector('iframe[src*="google.com/maps/embed"]:not([data-gg-helper])');
      let loc = iframe && (await getRoundLocation(iframe.src));
      if (!loc && !iframe && gameLocations) loc = gameLocations[roundIndex] || null;
      if (!loc) {
        console.warn("GeoHelper locate: no location found", { iframe: iframe && iframe.src, roundIndex, rounds: gameLocations && gameLocations.length });
        return reply({
          ok: false,
          error: gameLocations
            ? "No location found for this round."
            : "Round locations weren't captured — reload the page and start a new game.",
        });
      }

      const m = await findMap();
      if (!m) return reply({ ok: false, error: "Couldn't find the guess map." });

      // OpenGuessr's own click handler only reads e.latlng to place the
      // guess pin, so firing a Leaflet click at the exact coordinates
      // places it there. Deliberately does nothing else: no pan/zoom,
      // no guess submission.
      let [lat, lng] = loc;
      let offsetKm = 0;
      if (opts.offset) {
        const min = Number.isFinite(opts.offsetMinKm) ? opts.offsetMinKm : 1;
        const max = Number.isFinite(opts.offsetMaxKm) ? opts.offsetMaxKm : 100;
        offsetKm = min + Math.random() * Math.max(0, max - min);
        [lat, lng] = destination(lat, lng, offsetKm, Math.random() * 360);
      }
      const latlng = window.L.latLng(lat, lng);
      m.fire("click", {
        latlng,
        layerPoint: m.latLngToLayerPoint(latlng),
        containerPoint: m.latLngToContainerPoint(latlng),
      });
      reply({ ok: true, offsetKm });
    } catch (err) {
      console.error("GeoHelper locate:", err);
      reply({ ok: false, error: "Locate failed — see console." });
    }
  });
})();
