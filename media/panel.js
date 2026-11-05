// Pip's Corner webview. No inline handlers; talks to the extension via postMessage only.
(function () {
  'use strict';
  var vscode = acquireVsCodeApi();
  var CELL = 8;
  var ANIM = {
    UNIMPRESSED: 'pip-idle', RECKLESS: 'pip-fire', APPALLED: 'pip-shock', SLEEPY: 'pip-sleep',
    SMUG: 'pip-party', DEAD: 'pip-dead', SULKING: 'pip-sulk', NIGHTCAP: 'pip-sleep', CRACKED: 'pip-party'
  };
  var LABEL = {
    UNIMPRESSED: 'unimpressed', RECKLESS: 'reckless', APPALLED: 'appalled', SLEEPY: 'sleepy', SMUG: 'smug',
    DEAD: 'dead', SULKING: 'sulking, facing away', NIGHTCAP: 'in a night cap', CRACKED: 'almost smiling'
  };
  var FX_PARTS = { fire: 3, sweat: 2, zzz: 3, smoke: 3, confetti: 8, question: 1 };
  var FX_GLYPH = { fire: '▲', sweat: '•', zzz: 'z', smoke: '○', confetti: '■', question: '?' };

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('sprite');
  var g = canvas.getContext('2d');
  var pip = $('pip');
  var stage = $('stage');
  var last = { mood: null, fx: null };

  function draw(mood) {
    var grid = PipSprite.moodSprite(mood);
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === 'transparent') continue;
        g.fillStyle = grid[y][x];
        g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    canvas.setAttribute('aria-label', 'Pip, ' + (LABEL[mood] || 'unimpressed'));
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // reflow so one-shot animations replay
    el.classList.add(cls);
  }

  function setMood(mood) {
    if (mood === last.mood) return;
    last.mood = mood;
    draw(mood);
    pip.className = 'pip';
    restart(pip, ANIM[mood] || 'pip-idle');
    if (mood === 'APPALLED' || mood === 'DEAD') restart(stage, 'shake');
  }

  function setFx(fx) {
    if (fx === last.fx) return;
    last.fx = fx;
    var box = $('fx');
    box.textContent = '';
    box.className = 'fx' + (fx ? ' fx-' + fx : '');
    var n = FX_PARTS[fx] || 0;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'p p' + i;
      s.textContent = FX_GLYPH[fx];
      box.appendChild(s);
    }
  }

  function setFaith(f) {
    var box = $('faith');
    box.textContent = '';
    for (var i = 0; i < 10; i++) {
      var b = document.createElement('span');
      b.className = 'block' + (i < f ? ' on' : '') + (f <= 2 && i < f ? ' low' : '');
      box.appendChild(b);
    }
    box.setAttribute('aria-valuenow', String(f));
    $('faith-num').textContent = f + '/10';
  }

  function setLine(line, hushed) {
    var b = $('bubble');
    var text = line || (hushed ? '(Pip has turned around.)' : '...');
    b.textContent = text;
    b.classList.toggle('muted', !line);
  }

  function fmtDate(iso) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function renderDiary(entries) {
    var list = $('diary');
    list.textContent = '';
    for (var i = entries.length - 1; i >= 0; i--) {
      var e = entries[i];
      var li = document.createElement('li');
      var h = document.createElement('div');
      h.className = 'entry-head vt';
      h.textContent = 'Day ' + e.dayNumber + ' · ' + fmtDate(e.date);
      var t = document.createElement('p');
      t.className = 'entry-text';
      t.textContent = e.text.replace(/^Day \d+\.\s*/, '');
      li.appendChild(h);
      li.appendChild(t);
      list.appendChild(li);
    }
    $('diary-empty').hidden = entries.length > 0;
  }

  function renderAchievements(items) {
    var list = $('achievements');
    list.textContent = '';
    items.forEach(function (a) {
      var li = document.createElement('li');
      var title = document.createElement('div');
      title.className = 'ach-title vt';
      title.textContent = a.title;
      var blurb = document.createElement('p');
      blurb.className = 'ach-blurb';
      blurb.textContent = a.blurb;
      var when = document.createElement('div');
      when.className = 'ach-when';
      when.textContent = new Date(a.at).toLocaleDateString();
      li.appendChild(title);
      li.appendChild(blurb);
      li.appendChild(when);
      list.appendChild(li);
    });
    $('ach-empty').hidden = items.length > 0;
  }

  function render(s) {
    setMood(s.mood);
    setFx(s.fx);
    setLine(s.line, s.hushed);
    setFaith(s.faith);
    var hush = $('btn-hush');
    hush.textContent = s.hushed ? 'Wake' : 'Hush';
    hush.setAttribute('data-command', s.hushed ? 'pip.wake' : 'pip.hush');
    $('btn-mode').textContent = 'Mode: ' + s.mode;
    renderDiary(s.diary || []);
    renderAchievements(s.achievements || []);
  }

  function showTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var id = tabs[i].getAttribute('data-tab');
      var on = id === name;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      $('pane-' + id).hidden = !on;
    }
  }

  document.querySelector('.tabs').addEventListener('click', function (ev) {
    var t = ev.target.closest('.tab');
    if (t) showTab(t.getAttribute('data-tab'));
  });
  document.querySelector('.controls').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-command]');
    if (b) vscode.postMessage({ kind: 'command', id: b.getAttribute('data-command') });
  });

  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.kind === 'state') render(m);
    else if (m.kind === 'showTab') showTab(m.tab);
    else if (m.kind === 'renderCard') {
      PipCard.render(m.card).then(function (dataUrl) {
        vscode.postMessage({ kind: 'cardPng', dataUrl: dataUrl });
      });
    }
  });

  setFaith(5);
  setMood('UNIMPRESSED');
  vscode.postMessage({ kind: 'ready' });
})();
