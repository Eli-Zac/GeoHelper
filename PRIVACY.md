# Privacy Policy for GeoHelper

_Last updated: 21 September 2026_

GeoHelper does not collect, store, transmit, or sell any personal data.

There is no account to create, no analytics, no tracking, no advertising,
and no third-party services involved in anything the extension does.

## What the extension stores

GeoHelper saves your own settings — minimum and maximum guess offset
distance, minimum and maximum wait time, and the Safe mode toggle state —
using Chrome's `chrome.storage.local` API. This data:

- stays on your computer,
- is only ever read by GeoHelper itself,
- is never sent anywhere, and
- is deleted when you uninstall the extension.

## Screenshots

The **Copy** button captures the current view of the page and places the
image on your system clipboard. The image is held in memory only for as
long as it takes to write it to the clipboard. It is never uploaded,
stored, logged, or sent to the developer or to anyone else.

## Network requests

GeoHelper makes exactly one kind of outbound request: when you click
**Check for updates** or **Update** in its settings, it reads the public
GitHub releases endpoint for its own repository to find the latest
published version number.

- The request is unauthenticated and carries no user data.
- Only the release tag and release page URL are read from the response.
- It happens only when you click the button — there is no background
  polling, and no request is made while you are simply playing.

GitHub receives this request and, like any web server, sees the
originating IP address. That is GitHub's standard server logging and is
covered by [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).
GeoHelper sends nothing beyond the request itself.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `debugger` | To capture the current view at full resolution via the DevTools Protocol when you press **Copy**. It attaches only to the tab you clicked in, and sends no commands other than screenshot capture. |
| `storage` | To save your settings locally, as described above. |
| `https://api.github.com/*` | To read the public release list when you check for updates. |

The extension's content scripts run only on `geoguessr.com` and
`openguessr.com`. It has no access to any other site you visit.

## Changes to this policy

Any change will be committed to this file in the
[GeoHelper repository](https://github.com/Eli-Zac/GeoHelper), so the full
history of this policy is public and auditable.

## Contact

Questions or concerns: open an issue at
<https://github.com/Eli-Zac/GeoHelper/issues>.
