# GeoHelper

A Chrome extension for GeoGuessr and OpenGuessr that adds:

- **Copy** — captures a full-resolution screenshot of the current panorama (via the DevTools Protocol, so it's sharper than a normal tab capture) and copies it to your clipboard. On OpenGuessr's Street View rounds it can sweep 360° and stitch the frames into one wide image.
- **Locate** (OpenGuessr only) — places the guess pin at the round's actual coordinates. A **Safe mode** toggle offsets the placed pin by a random 1–100 km instead of the exact spot.
- **Autoplay** (OpenGuessr only) — automatically guesses and continues each round on randomized delays, respecting Safe mode and any pin you've already placed with Locate.

## Installing

1. Grab the latest zip from [Releases](../../releases).
2. Unzip it.
3. In Chrome, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.

## Development

No build step — `manifest.json`, `background.js`, `content.js`, `content.css`, and `locate.js` are loaded as-is. After editing, hit the reload icon for the extension on `chrome://extensions`.

## Releasing

Releases go out only through a reviewed, merged PR — nobody hand-pushes a release tag:

1. On a branch, bump `"version"` in `manifest.json` to the new version (Chrome extension versions are 1–4 dot-separated integers, e.g. `1.2.0`).
2. Open a PR and get it reviewed and merged to `main`.
3. Once merged, the `Auto Tag Release` workflow notices `manifest.json`'s version doesn't have a matching tag yet and pushes `v1.2.0` to `main`.
4. That tag push triggers the `Release` workflow, which builds a zip with `manifest.json`'s version set to match the tag and publishes it as a GitHub Release.

Because the tag is only ever created from `main`, and `main` only moves via a reviewed PR (branch protection enforces this), every release traces back to a PR your other dev signed off on. A PR that doesn't touch `manifest.json`'s version just merges normally with no release.
