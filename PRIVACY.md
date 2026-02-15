# Privacy Policy — YouTube Winamp

**Effective Date:** February 19, 2026

## Overview

YouTube Winamp is a browser extension that provides a classic Winamp 2.x-style player interface to control music playback on YouTube Music, Spotify, and Amazon Music. This privacy policy describes how the extension handles user data.

## Data Collection

**YouTube Winamp does not collect, store, or transmit any personal data or user information.** No analytics, telemetry, or tracking of any kind is used.

## How the Extension Works

The extension reads playback information (track title, artist, playback state, volume, and queue) directly from the music service tab in your browser and displays it in the Winamp-style player window. All communication happens locally between the extension's components within your browser. No data ever leaves your device.

## Permissions

The extension requires the following browser permissions, each used solely for its core functionality:

| Permission | Purpose |
|---|---|
| `activeTab` | Interact with the currently active music service tab to control playback |
| `tabs` | Find open YouTube Music, Spotify, or Amazon Music tabs to connect the player |
| Content scripts on `music.youtube.com`, `open.spotify.com`, `music.amazon.com` | Read player state (title, artist, time, volume, queue) and send playback commands (play, pause, skip, etc.) |

## Third-Party Services

YouTube Winamp does not communicate with any external servers, APIs, or third-party services. It interacts only with the music service websites already open in your browser.

## Local Storage

The extension does not use browser local storage, cookies, or any persistent storage mechanism to store personal information. Skin files loaded by the user are processed in memory and not retained.

## Children's Privacy

The extension does not knowingly collect any information from anyone, including children under the age of 13.

## Changes to This Policy

If this privacy policy is updated, the changes will be posted here with an updated effective date. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/user/youtube-winamp/issues).
