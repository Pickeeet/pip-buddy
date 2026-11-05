# Publishing notes (for the maintainer)

- `publisher` in `package.json` is the placeholder `pip-buddy-dev`. Replace it with your real publisher id (and the repository URL) before publishing.
- Check the extension name is free on the Marketplace and Open VSX; if not, rename (for example `pixel-buddy`).
- `npm run build && npx vsce package` produces `pip-buddy-0.1.0.vsix`. Publishing (`vsce publish`, `ovsx publish`) is done with your own tokens.
- Tests: `npm run test:unit`, and `npm run test:int` (downloads an official VS Code test build once).
- `scripts/icon.mjs` regenerates `media/icon.png` from the sprite.
