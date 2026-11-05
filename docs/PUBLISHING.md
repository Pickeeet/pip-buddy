# Publishing notes (for the maintainer)

- Publisher id is `pip-buddy` and the repository is `https://github.com/Pickeeet/pip-buddy`. Create the Marketplace publisher and the Open VSX namespace with exactly that id; if `pip-buddy` turns out to be taken, change `publisher` in `package.json` and the extension id in `test/integration/suite/pip.test.ts`.
- Name check (2026-11-05): `pip-buddy` and the display name were free on both the Marketplace and Open VSX. "Pixel Buddy" is already taken on the Marketplace, so it is not a usable fallback.
- `npm run build && npx vsce package` produces `pip-buddy-0.1.0.vsix`. Publishing (`vsce publish`, `ovsx publish`) is done with your own tokens.
- Tests: `npm run test:unit`, and `npm run test:int` (downloads an official VS Code test build once).
- `scripts/icon.mjs` regenerates `media/icon.png` from the sprite.
