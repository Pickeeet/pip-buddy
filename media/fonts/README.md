# Fonts (to drop in)

Pip's webview expects these files here. They were not bundled because they could not be obtained offline.
Until they are added, `panel.css` falls back to the system monospace font. No remote font URLs are used.

| File | Font | Source |
| --- | --- | --- |
| `VT323-Regular.woff2` | VT323 (Peter Hull) | Google Fonts, SIL Open Font License 1.1 |
| `JetBrainsMono-Regular.woff2` | JetBrains Mono | github.com/JetBrains/JetBrainsMono, SIL Open Font License 1.1 |
| `OFL.txt` | The OFL 1.1 text with both fonts' copyright lines | ships with each font |

`.ttf` works too if you change the `src:` lines at the top of `media/panel.css`.
