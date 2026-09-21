# GeoHelper

A Chrome extension for GeoGuessr and OpenGuessr that adds:

- **Copy** — captures a full-resolution screenshot of the current panorama (via the DevTools Protocol, so it's sharper than a normal tab capture) and copies it to your clipboard. On OpenGuessr's Street View rounds it can sweep 360° and stitch the frames into one wide image.
- **Locate** (OpenGuessr only) — places the guess pin at the round's actual coordinates. A **Safe mode** toggle offsets the placed pin by a random 1–100 km instead of the exact spot.
- **Autoplay** (OpenGuessr only) — automatically guesses and continues each round on randomized delays, respecting Safe mode and any pin you've already placed with Locate.

## Installing

Install from the Chrome Web Store listing. Chrome then keeps the extension up
to date on its own, and **Update** in GeoHelper's settings forces a check and
installs a new version immediately.

<details>
<summary>Installing unpacked instead (development, or before the listing is live)</summary>

1. Grab the latest zip from [Releases](../../releases).
2. Unzip it.
3. In Chrome, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.

Chrome has no update channel for an unpacked copy, so **Update** falls back to
comparing against the latest GitHub release and linking to it — you replace the
folder yourself.

</details>

## Updating

`background.js` decides which of the two it can do by checking whether
`chrome.runtime.getManifest()` has an `update_url`, which Chrome only adds to
extensions it installed itself:

- **Store install** — `chrome.runtime.requestUpdateCheck()` asks Chrome to fetch
  the new version, then `chrome.runtime.reload()` restarts into it. That tears
  down every content script, so open game tabs need a refresh afterwards.
- **Unpacked** — falls back to the GitHub Releases API and a download link.

There's deliberately no `chrome.runtime.onUpdateAvailable` listener: registering
one makes Chrome hold updates back until the extension calls `reload()` itself,
and restarting unprompted would kill an Autoplay run mid-round. Without a
listener Chrome installs new versions once the extension goes idle.

## Development

No build step — `manifest.json`, `background.js`, `content.js`, `content.css`, and `locate.js` are loaded as-is. After editing, hit the reload icon for the extension on `chrome://extensions`.

## Releasing

Releases go out only through a reviewed, merged PR — nobody hand-pushes a release tag:

1. On a branch, bump `"version"` in `manifest.json` to the new version (Chrome extension versions are 1–4 dot-separated integers, e.g. `1.2.0`).
2. Open a PR and get it reviewed and merged to `main`.
3. Once merged, the `Auto Tag Release` workflow checks whether this push actually changed `manifest.json`'s version and whether a tag for it already exists; if so, it pushes `v1.2.0` to `main`.
4. Since a `GITHUB_TOKEN`-authored tag push doesn't trigger other workflows, `Auto Tag Release` then calls the `Release` workflow directly (as a reusable workflow, in-process) with that tag, which builds a zip with `manifest.json`'s version set to match the tag and publishes it as a GitHub Release.

Because the tag is only ever created from `main`, and `main` only moves via a reviewed PR (branch protection enforces this), every release traces back to a PR your other dev signed off on. A PR that doesn't bump `manifest.json`'s version just merges normally with no release.
