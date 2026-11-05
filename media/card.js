// Weekly Roast Card: draws a 1200x630 PNG off-screen. Loaded after sprite.js; panel.js calls PipCard.render().
(function (root) {
  'use strict';
  var W = 1200;
  var H = 630;
  var BG = '#0F0E17';
  var TEXT = '#E6E3FF';
  var ACCENT = '#6EE7A8';
  var DIM = '#8C88B0';
  var PANEL = '#17152A';
  var PAD = 60;
  var VT = "'VT323', monospace";
  var MONO = "'JetBrains Mono', monospace";

  function wrap(g, text, maxWidth) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (cur && g.measureText(next).width > maxWidth) { lines.push(cur); cur = w; } else { cur = next; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /**
   * Quote lines for the diary: up to `maxLines`. When the text does not fit, the last kept line ends
   * with an ellipsis, and the closing quote mark is always present.
   */
  function quoteLines(g, body, maxWidth, maxLines) {
    var OPEN = String.fromCharCode(0x201c);
    var CLOSE = String.fromCharCode(0x201d);
    var ELLIPSIS = String.fromCharCode(0x2026);
    var full = wrap(g, OPEN + body + CLOSE, maxWidth);
    if (full.length <= maxLines) return full;
    var kept = wrap(g, OPEN + body, maxWidth).slice(0, maxLines);
    var trim = function (t) { return t.replace(/[ .,;:!?-]+$/, ''); };
    var last = trim(kept[maxLines - 1]);
    while (last.indexOf(' ') > 0 && g.measureText(last + ELLIPSIS + CLOSE).width > maxWidth) {
      last = trim(last.slice(0, last.lastIndexOf(' ')));
    }
    kept[maxLines - 1] = last + ELLIPSIS + CLOSE;
    return kept;
  }

  function drawSprite(g, grid, x, y, cell) {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === 'transparent') continue;
        g.fillStyle = grid[r][c];
        g.fillRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
  }

  function draw(card) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var g = canvas.getContext('2d');
    g.textBaseline = 'alphabetic';

    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = ACCENT;
    g.lineWidth = 4;
    g.strokeRect(14, 14, W - 28, H - 28);

    // Title
    g.fillStyle = ACCENT;
    g.font = '84px ' + VT;
    g.fillText("PIP'S WEEKLY ROAST", PAD, 108);
    g.fillStyle = DIM;
    g.font = '30px ' + VT;
    g.fillText('Week of ' + card.weekOf + ' \u00b7 ' + card.dayCount + (card.dayCount === 1 ? ' day' : ' days') + ' observed', PAD, 148);

    // Pip
    var mood = card.cracked ? 'CRACKED' : 'SMUG';
    var m = PipSprite.MOODS[mood];
    var grid = PipSprite.spriteGrid(m.eyes, m.mouth, m.body);
    drawSprite(g, grid, 880, 70, 15);

    // Offences
    g.fillStyle = TEXT;
    g.font = '40px ' + VT;
    g.fillText('TOP OFFENCES', PAD, 215);
    g.font = '26px ' + MONO;
    if (card.topOffences.length === 0) {
      g.fillStyle = DIM;
      g.fillText('None. Pip is suspicious.', PAD, 258);
    } else {
      card.topOffences.forEach(function (o, i) {
        var y = 258 + i * 40;
        g.fillStyle = TEXT;
        g.fillText(o.label, PAD, y);
        g.fillStyle = ACCENT;
        g.textAlign = 'right';
        g.fillText('x' + o.count, 560, y);
        g.textAlign = 'left';
      });
    }

    // Faith bar
    g.fillStyle = TEXT;
    g.font = '40px ' + VT;
    g.fillText('FAITH', PAD, 405);
    var bx = 190;
    for (var i = 0; i < 10; i++) {
      g.fillStyle = i < card.faithEnd ? (card.faithEnd <= 2 ? '#FF6B6B' : ACCENT) : PANEL;
      g.fillRect(bx + i * 34, 380, 28, 30);
    }
    g.strokeStyle = DIM;
    g.lineWidth = 2;
    g.strokeRect(bx - 4, 376, 10 * 34 + 2, 38);
    g.fillStyle = DIM;
    g.font = '30px ' + VT;
    g.fillText(card.faithStart + '/10 \u2192 ' + card.faithEnd + '/10', bx + 10 * 34 + 24, 405);

    // Diary quote
    var y = 460;
    if (card.diaryLine) {
      g.fillStyle = TEXT;
      g.font = 'italic 22px ' + MONO;
      quoteLines(g, card.diaryLine.replace(/^Day \d+\.\s*/, ''), W - PAD * 2, 3).forEach(function (ln) {
        g.fillText(ln, PAD, y);
        y += 30;
      });
    }

    // Achievement
    if (card.achievement) {
      g.fillStyle = ACCENT;
      g.font = '34px ' + VT;
      g.fillText('Achievement unlocked: ' + card.achievement, PAD, Math.max(y + 14, 540));
    }

    // Footer
    g.fillStyle = DIM;
    g.font = '30px ' + VT;
    g.fillText(card.cracked ? 'Pip cracked this week. It denies everything.' : 'Pip remained unimpressed.', PAD, H - 40);

    return canvas;
  }

  /** Waits for the bundled fonts, draws, resolves with a PNG data URL. */
  function render(card) {
    var loads = ['84px VT323', '26px "JetBrains Mono"', 'italic 22px "JetBrains Mono"'].map(function (f) {
      return document.fonts.load(f).catch(function () {});
    });
    return Promise.all(loads)
      .then(function () { return document.fonts.ready; })
      .then(function () { return draw(card).toDataURL('image/png'); });
  }

  root.PipCard = { render: render, quoteLines: quoteLines };
})(typeof globalThis !== 'undefined' ? globalThis : this);
