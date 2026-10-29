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

  /** @type {Record<string, string>} */
  let sprites = {};
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

  /** Restart the CSS entry animations even if the girl is already on screen. */
  function enter() {
    stage.classList.remove('visible', 'leaving', 'said', 'talking');
    void stage.offsetWidth;
    stage.classList.add('visible');
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

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'init') {
      sprites = msg.sprites;
      setSprite('idle');
    } else if (msg.type === 'react') {
      react(msg.reaction, msg.durationMs);
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
