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

Releases are tag-driven:

1. Pick a version (Chrome extension versions are 1–4 dot-separated integers, e.g. `1.2.0`).
2. `git tag v1.2.0 && git push origin v1.2.0`
3. The `Release` workflow builds a zip with `manifest.json`'s version set to match the tag, publishes it as a GitHub Release, and syncs that version back into `manifest.json` on `main` if it isn't already there.

You don't need to hand-edit `manifest.json`'s version before tagging — the workflow does it. If you do bump it by hand first, the workflow just confirms it already matches and skips the sync commit.
