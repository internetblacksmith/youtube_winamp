# YouTube Winamp

Chrome extension that wraps YouTube Music, Spotify, and Amazon Music in a pixel-perfect Winamp 2.x interface with WSZ skin support.

## Build Commands

```bash
# No build step — load unpacked in chrome://extensions
# Lint with any standard JS linter:
npx eslint *.js
```

## Critical Rules

- Pin dependencies to exact versions (e.g., `"package": "1.2.3"`)
- Keep docs updated with every code change
- Keep Makefile updated - add new tasks as project evolves
- No build tools or frameworks — raw JS/CSS/HTML only
- All DOM selectors in bridge files must have fallbacks for service UI changes
