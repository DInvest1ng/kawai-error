// @ts-check
(function () {
  // @ts-ignore acquireVsCodeApi is injected by VS Code
  const vscode = acquireVsCodeApi();
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const stage = $('stage');
  const girl = /** @type {HTMLImageElement} */ ($('girl'));
  const phrase = $('phrase');
  const detail = $('detail');
  const source = $('source');
  const count = $('count');
  const fx = $('fx');
  const pickBtn = $('pick');
  const picker = $('picker');
  const track = $('pk-track');
  const dots = $('pk-dots');
  const prevBtn = /** @type {HTMLButtonElement} */ ($('pk-prev'));
  const nextBtn = /** @type {HTMLButtonElement} */ ($('pk-next'));
  const chooseBtn = /** @type {HTMLButtonElement} */ ($('pk-choose'));

  const APPEAR_MS = 480;
  const LEAVE_MS = 450;
  const TYPE_MS = 45;
  const MOUTH_MS = 140;
  const SOURCE_LABELS = {
    diagnostics: 'Problems',
    task: 'Задача',
    terminal: 'Терминал',
    debug: 'Отладка',
    test: 'Тест',
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BURST = ['sakura', 'sakura', 'sakura', 'heart', 'heart', 'sparkle', 'sparkle'];

  /** @typedef {{id: string, name: string, sprites: Record<string, string>}} CharacterCard */
  /** @type {Record<string, string>} */
  let sprites = {};
  /** @type {CharacterCard[]} */
  let characters = [];
  let currentId = '';
  /** Carousel position. */
  let index = 0;
  /** @type {number | undefined} */
  let previewTimer;
  /** @type {number[]} */
  let timers = [];
  /** @type {number | undefined} */
  let mouthTimer;

  function later(/** @type {() => void} */ fn, /** @type {number} */ ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function resetTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
    stopTalking();
  }

  function setSprite(/** @type {string} */ name) {
    const src = sprites[name] || sprites.idle || '';
    if (girl.getAttribute('src') !== src) {
      girl.src = src;
    }
  }

  /** Tell the extension whether the sprite actually rendered (catches CSP / URI problems). */
  function reportShown(/** @type {string} */ name) {
    const send = () => vscode.postMessage({ type: 'shown', sprite: name, loaded: girl.naturalWidth > 0 });
    if (girl.complete) {
      send();
    } else {
      girl.addEventListener('load', send, { once: true });
      girl.addEventListener('error', send, { once: true });
    }
  }

  function startTalking(/** @type {string} */ emotion) {
    stage.classList.add('talking');
    let open = false;
    if (!sprites.talk) {
      return;
    }
    mouthTimer = window.setInterval(() => {
      open = !open;
      setSprite(open ? 'talk' : emotion);
    }, MOUTH_MS);
  }

  function stopTalking() {
    if (mouthTimer !== undefined) {
      clearInterval(mouthTimer);
      mouthTimer = undefined;
    }
    stage.classList.remove('talking');
  }

  /** Petals, hearts and sparkles floating up around the girl. */
  function burst() {
    fx.replaceChildren();
    if (reducedMotion.matches) {
      return;
    }
    const rand = (/** @type {number} */ min, /** @type {number} */ max) => min + Math.random() * (max - min);
    for (let i = 0; i < 12; i++) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', `#${BURST[i % BURST.length]}`);
      svg.appendChild(use);
      const vars = {
        '--x': `${rand(-15, 95)}%`,
        '--y': `${rand(10, 75)}%`,
        '--size': `${rand(10, 22)}px`,
        '--dx': `${rand(-30, 30)}px`,
        '--rot': `${rand(-200, 200)}deg`,
        '--dur': `${rand(1400, 2400)}ms`,
        '--delay': `${rand(250, 900)}ms`,
      };
      for (const [k, v] of Object.entries(vars)) {
        svg.style.setProperty(k, v);
      }
      fx.appendChild(svg);
    }
  }

  /** Restart the CSS entry animations even if the girl is already on screen. */
  function enter() {
    stage.classList.remove('visible', 'leaving', 'said', 'talking');
    void stage.offsetWidth;
    stage.classList.add('visible');
    burst();
  }

  function leave() {
    stopTalking();
    stage.classList.add('leaving');
    later(() => {
      stage.classList.remove('visible', 'leaving', 'said');
      setSprite('idle');
    }, reducedMotion.matches ? 0 : LEAVE_MS);
  }

  function typeText(/** @type {string} */ text, /** @type {() => void} */ done) {
    const chars = Array.from(text);
    if (reducedMotion.matches) {
      phrase.textContent = text;
      done();
      return;
    }
    phrase.textContent = '';
    chars.forEach((_, i) => {
      later(() => {
        phrase.textContent = chars.slice(0, i + 1).join('');
        if (i === chars.length - 1) {
          done();
        }
      }, i * TYPE_MS);
    });
  }

  /** @param {{phrase: string, emotion: string, source: string, detail: string, count: number}} r */
  function react(r, /** @type {number} */ durationMs) {
    resetTimers();
    setSprite(r.emotion);
    reportShown(r.emotion);
    source.textContent = SOURCE_LABELS[/** @type {keyof typeof SOURCE_LABELS} */ (r.source)] || r.source;
    count.textContent = r.count > 1 ? `×${r.count}` : '';
    detail.textContent = r.detail;
    phrase.textContent = '';
    enter();

    const appearDelay = reducedMotion.matches ? 0 : APPEAR_MS;
    later(() => {
      startTalking(r.emotion);
      typeText(r.phrase, () => {
        stopTalking();
        setSprite(r.emotion);
        stage.classList.add('said');
      });
    }, appearDelay);

    later(leave, Math.max(durationMs, appearDelay + Array.from(r.phrase).length * TYPE_MS + 1000));
  }

  // ---- Character carousel ----

  function isPickerOpen() {
    return !picker.hidden;
  }

  function renderCarousel() {
    track.replaceChildren();
    dots.replaceChildren();
    characters.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'pk-card';
      card.dataset.index = String(i);
      const img = document.createElement('img');
      img.className = 'pk-img';
      img.alt = c.name;
      img.src = c.sprites.idle || '';
      const name = document.createElement('p');
      name.className = 'pk-name';
      name.textContent = c.name;
      if (c.id === currentId) {
        const badge = document.createElement('span');
        badge.className = 'pk-badge';
        badge.textContent = '♡ сейчас';
        name.appendChild(badge);
      }
      card.append(img, name);
      card.addEventListener('click', () => (i === index ? choose() : go(i)));
      track.appendChild(card);

      const dot = document.createElement('span');
      dot.className = 'pk-dot';
      dots.appendChild(dot);
    });
    layout();
  }

  /** Positions cards around the centered one and previews its happy face. */
  function layout() {
    Array.from(track.children).forEach((el, i) => {
      const card = /** @type {HTMLElement} */ (el);
      const offset = i - index;
      card.style.setProperty('--offset', String(offset));
      card.style.setProperty('--scale', offset === 0 ? '1' : '0.72');
      card.style.setProperty('--alpha', offset === 0 ? '1' : '0.5');
      card.classList.toggle('center', offset === 0);
      card.classList.toggle('far', Math.abs(offset) > 1);
      const img = /** @type {HTMLImageElement} */ (card.querySelector('.pk-img'));
      img.src = characters[i].sprites.idle || '';
    });
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === index));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === characters.length - 1;
    chooseBtn.textContent = characters[index]?.id === currentId ? 'Оставить ♡' : 'Выбрать ♡';

    if (previewTimer !== undefined) {
      clearTimeout(previewTimer);
    }
    previewTimer = window.setTimeout(() => {
      const center = track.children[index]?.querySelector('.pk-img');
      const happy = characters[index]?.sprites.happy;
      if (center && happy && isPickerOpen()) {
        /** @type {HTMLImageElement} */ (center).src = happy;
      }
    }, 600);
  }

  function go(/** @type {number} */ i) {
    index = Math.max(0, Math.min(characters.length - 1, i));
    layout();
  }

  function openPicker() {
    if (characters.length === 0) {
      return;
    }
    index = Math.max(0, characters.findIndex((c) => c.id === currentId));
    picker.hidden = false;
    renderCarousel();
    chooseBtn.focus();
  }

  function closePicker() {
    picker.hidden = true;
    if (previewTimer !== undefined) {
      clearTimeout(previewTimer);
    }
  }

  function choose() {
    const c = characters[index];
    closePicker();
    if (c) {
      vscode.postMessage({ type: 'select', id: c.id });
    }
  }

  pickBtn.addEventListener('click', openPicker);
  $('pk-close').addEventListener('click', closePicker);
  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));
  chooseBtn.addEventListener('click', choose);

  window.addEventListener('keydown', (e) => {
    if (!isPickerOpen()) {
      return;
    }
    const keys = { ArrowLeft: () => go(index - 1), ArrowRight: () => go(index + 1), Enter: choose, Escape: closePicker };
    const action = keys[/** @type {keyof typeof keys} */ (e.key)];
    if (action) {
      e.preventDefault();
      action();
    }
  });

  let wheelLock = 0;
  picker.addEventListener(
    'wheel',
    (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = Date.now();
      if (Math.abs(delta) < 15 || now < wheelLock) {
        return;
      }
      wheelLock = now + 350;
      go(index + Math.sign(delta));
    },
    { passive: true },
  );

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'init') {
      characters = msg.characters;
      currentId = msg.current;
      sprites = characters.find((c) => c.id === currentId)?.sprites ?? {};
      pickBtn.hidden = characters.length < 2;
      if (!stage.classList.contains('visible')) {
        setSprite('idle');
      }
      if (isPickerOpen()) {
        renderCarousel();
      }
    } else if (msg.type === 'react') {
      react(msg.reaction, msg.durationMs);
    } else if (msg.type === 'openPicker') {
      openPicker();
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
