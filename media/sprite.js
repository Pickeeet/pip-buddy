// Pip's 16x12 pixel sprite. UMD-style: the webview reads `PipSprite` off the global,
// vitest requires it as a CommonJS module. Grids and palette ported from the original mockup.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PipSprite = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BASE = [
    '....oooooooo....',
    '..oobbbbbbbboo..',
    '.obhhbbbbbbbbbo.',
    '.obhbbbbbbbbbbo.',
    'obbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbo',
    'obccbbbbbbbbccbo',
    'obbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbo',
    '.obbbbbbbbbbbbo.',
    '..oobbbbbbbboo..',
    '...oo......oo...'
  ];
  var EYES = {
    normal: ['obbbeebbbbeebbbo', 'obbbeebbbbeebbbo'],
    happy: ['obbbbebbbbbebbbo', 'obbbebebbbebebbo'],
    sleep: ['obbbbbbbbbbbbbbo', 'obbbeeebbbeeebbo'],
    shock: ['obbeeebbbbeeebbo', 'obbeeebbbbeeebbo'],
    dead: ['obbbebebbebebbbo', 'obbbbebbbbebbbbo'],
    side: ['obbbbbbbbbbbbbbo', 'obbbbbeebbbbbeeo']
  };
  var MOUTH = {
    neutral: ['obbbbbbmmbbbbbbo', 'obbbbbbbbbbbbbbo'],
    smile: ['obbbbbmbbmbbbbbo', 'obbbbbbmmbbbbbbo'],
    open: ['obbbbbbmmbbbbbbo', 'obbbbbbmmbbbbbbo'],
    frown: ['obbbbbbmmbbbbbbo', 'obbbbbmbbmbbbbbo'],
    smirk: ['obbbbbbbbmmmbbbo', 'obbbbbbbbbbbbbbo'],
    flat: ['obbbbbbbbbbbbbbo', 'obbbbbbmmbbbbbbo']
  };
  // Back view: the face rows are plain body.
  var BACK = 'obbbbbbbbbbbbbbo';
  // Night cap: replaces the top three rows (k = cap, w = pom-pom).
  var CAP = [
    '....oooooooooow.',
    '..ookkkkkkkkkko.',
    '.okkkkkkkkkkkkko'
  ];

  var BODY = '#6EE7A8';
  var RECKLESS_BODY = '#FFB547';
  var PALETTE = { '.': 'transparent', o: '#1B1530', h: '#EFFFF5', c: '#FF8FB1', e: '#1B1530', m: '#1B1530', k: '#8FA3FF', w: '#EFFFF5' };

  var MOODS = {
    UNIMPRESSED: { eyes: 'side', mouth: 'flat', body: BODY },
    RECKLESS: { eyes: 'side', mouth: 'smirk', body: RECKLESS_BODY },
    APPALLED: { eyes: 'shock', mouth: 'open', body: BODY },
    SLEEPY: { eyes: 'sleep', mouth: 'flat', body: BODY },
    SMUG: { eyes: 'happy', mouth: 'smirk', body: BODY },
    DEAD: { eyes: 'dead', mouth: 'frown', body: BODY },
    SULKING: { back: true, body: BODY },
    NIGHTCAP: { eyes: 'sleep', mouth: 'flat', body: BODY, cap: true },
    CRACKED: { eyes: 'normal', mouth: 'smile', body: BODY }
  };

  function paint(rows, body) {
    return rows.map(function (r) {
      return r.split('').map(function (ch) { return ch === 'b' ? body : PALETTE[ch]; });
    });
  }

  function rowsFor(eyes, mouth) {
    var rows = BASE.slice();
    var e = EYES[eyes] || EYES.side;
    var m = MOUTH[mouth] || MOUTH.flat;
    rows[4] = e[0]; rows[5] = e[1];
    rows[7] = m[0]; rows[8] = m[1];
    return rows;
  }

  /** 12 rows x 16 colours (CSS colour strings, 'transparent' for empty cells). */
  function spriteGrid(eyes, mouth, body) {
    return paint(rowsFor(eyes, mouth), body);
  }

  function moodSprite(mood) {
    var m = MOODS[mood] || MOODS.UNIMPRESSED;
    var rows;
    if (m.back) {
      rows = BASE.slice();
      rows[4] = rows[5] = rows[7] = rows[8] = BACK;
    } else {
      rows = rowsFor(m.eyes, m.mouth);
    }
    if (m.cap) { rows[0] = CAP[0]; rows[1] = CAP[1]; rows[2] = CAP[2]; }
    return paint(rows, m.body);
  }

  return { spriteGrid: spriteGrid, moodSprite: moodSprite, MOODS: MOODS };
});
