// @ts-check
(function () {
  // @ts-ignore acquireVsCodeApi is injected by VS Code
  const vscode = acquireVsCodeApi();
  const girl = /** @type {HTMLImageElement} */ (document.getElementById('girl'));
  const bubble = /** @type {HTMLElement} */ (document.getElementById('bubble'));
  const phrase = /** @type {HTMLElement} */ (document.getElementById('phrase'));
  const detail = /** @type {HTMLElement} */ (document.getElementById('detail'));

  /** @type {Record<string, string>} */
  let sprites = {};

  bubble.classList.add('hidden');

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'init') {
      sprites = msg.sprites;
      girl.src = sprites.idle || '';
    } else if (msg.type === 'react') {
      const r = msg.reaction;
      girl.src = sprites[r.emotion] || sprites.idle || '';
      phrase.textContent = r.phrase;
      detail.textContent = r.detail;
      bubble.classList.remove('hidden');
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
