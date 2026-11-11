// Executa uma sequência de exercícios, uma pergunta por tela (porte de UI/ExerciseRunner.cs).
import * as Kana from './kana.js';
import { Store } from './store.js';
import { Speech } from './speech.js';
import { shuffle, correctAnswerText } from './exercises.js';
import { h, icons, infoBox, jpBlock, sentenceCard, section, jpSpan } from './ui.js';

const PRAISE = ['Correto! 正解！', 'Muito bem! よくできました！', 'Isso aí! すごい！', 'Perfeito! 完璧！'];

export function createRunner({ title, generator, onComplete, onExit }) {
  let queue = [];
  let pos = 0;
  let originalCount = 0;
  let failed = new Set();
  let retried = new Set();
  let firstTryCorrect = 0;
  let answered = false;
  let cur = null;
  let selected = -1;
  let optionButtons = [];
  let input = null;
  let answerArea = null;
  let bankArea = null;
  let finished = false;

  const progressFill = h('div.bar-fill');
  const counter = h('div.runner-counter');
  const body = h('main.runner-body');
  const fbTitle = h('div.fb-title');
  const fbText = h('div.fb-text');
  const fbSpeak = h('button.icon-btn', { type: 'button', 'aria-label': 'Ouvir a resposta', onclick: () => Speech.speak(cur.speakText) }, icons.volume);
  const mainBtn = h('button.btn.primary.big', { type: 'button', onclick: () => mainAction() }, 'Verificar');
  const foot = h('footer.runner-foot', h('div.fb', fbTitle, fbText), h('div.fb-actions', fbSpeak, mainBtn));
  const root = h('div.runner',
    h('header.runner-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Sair', onclick: () => requestExit() }, icons.close),
      h('div.bar.runner-bar', progressFill),
      counter),
    body,
    foot);

  root.addEventListener('keydown', (e) => {
    if (finished) return;
    if (e.key === 'Enter' && e.target !== input) { e.preventDefault(); mainAction(); }
    if (!answered && (cur?.type === 'choice' || cur?.type === 'listen')) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= optionButtons.length) selectOption(n - 1);
    }
  });

  function requestExit() {
    if (finished || pos === 0 || confirm('Sair agora? O progresso desta sessão será perdido.')) {
      Speech.stop();
      onExit();
    }
  }

  function start() {
    queue = generator();
    originalCount = queue.length;
    pos = 0;
    failed = new Set();
    retried = new Set();
    firstTryCorrect = 0;
    finished = false;
    if (queue.length === 0) {
      body.replaceChildren(h('h2', 'Nenhum exercício disponível.'), h('button.btn.primary', { type: 'button', onclick: onExit }, 'Voltar'));
      foot.hidden = true;
      return;
    }
    showExercise();
  }

  function setMain(text, kind, enabled) {
    mainBtn.textContent = text;
    mainBtn.className = 'btn big ' + kind;
    mainBtn.disabled = !enabled;
  }

  function showExercise() {
    cur = queue[pos];
    answered = false;
    selected = -1;
    optionButtons = [];
    input = null;
    answerArea = null;
    bankArea = null;
    progressFill.style.width = `${(pos / Math.max(1, queue.length)) * 100}%`;
    counter.textContent = `${Math.min(pos + 1, queue.length)} / ${queue.length}`;
    body.replaceChildren();
    body.scrollTop = 0;
    foot.hidden = false;
    foot.className = 'runner-foot';
    fbTitle.textContent = '';
    fbText.textContent = {
      choice: 'Toque numa opção e depois em Verificar.',
      listen: 'Toque numa opção e depois em Verificar.',
      typing: 'Digite em romaji (ex.: "arigatou") — vira kana automaticamente.',
      order: 'Toque nas peças na ordem certa. Toque numa peça colocada para devolvê-la.',
    }[cur.type] || '';
    fbSpeak.hidden = true;
    setMain('Verificar', 'primary', false);

    const s = Store.settings;
    if (retried.has(cur)) body.append(h('div.retry-note', '↻ Revisão de um erro anterior'));
    if (cur.passage) body.append(h('div.passage', { lang: 'ja' }, cur.passage));
    if (cur.context) body.append(infoBox('📍 ' + cur.context, 'indigo'));
    body.append(h('h2.prompt', jpSpan(cur.prompt)));

    const audioAllowed = Speech.available && (cur.type === 'listen' || (cur.japanese != null && !cur.audioRevealsAnswer));
    if (cur.type === 'listen') {
      body.append(h('div.listen-row',
        h('button.btn.indigo.big', { type: 'button', onclick: () => Speech.speak(cur.speakText) }, icons.volume + ' Ouvir'),
        h('button.btn.indigo-soft.big', { type: 'button', onclick: () => Speech.speak(cur.speakText, true) }, icons.slow + ' Devagar')));
      if (!Speech.available) body.append(infoBox('(Sem voz japonesa — leia o texto)  ' + cur.speakText, 'warn'));
    }

    if (cur.japanese) {
      const jp = cur.japanese;
      const size = cur.bigJapanese ? 'xl' : jp.length > 22 ? 'sm' : 'md';
      const reading = cur.japaneseReading && s.ShowReading ? cur.japaneseReading : null;
      const romSource = cur.japaneseReading ?? jp;
      let romaji = null;
      if (s.ShowRomaji && !cur.bigJapanese && !cur.audioRevealsAnswer && !romSource.includes('___') &&
        Kana.isAllKana(romSource.replace(/[。、？！]/g, ''))) romaji = Kana.toRomaji(romSource);
      body.append(jpBlock(jp, { size, reading, romaji, speak: audioAllowed && cur.type !== 'listen' ? cur.speakText : null }));
    }

    if (cur.type === 'choice' || cur.type === 'listen') buildOptions();
    else if (cur.type === 'typing') buildTyping();
    else if (cur.type === 'order') buildOrder();

    const autoplay = Speech.available && (cur.type === 'listen' ||
      (s.AutoPlayAudio && cur.type === 'choice' && cur.japanese != null && !cur.audioRevealsAnswer && !cur.japanese.includes('___')));
    const ex = cur;
    setTimeout(() => {
      if (ex !== cur) return;
      if (autoplay) Speech.speak(ex.speakText);
      if (input) input.focus();
    }, 120);
  }

  function buildOptions() {
    const list = h('div.options');
    cur.options.forEach((opt, i) => {
      const jp = cur.optionsJapanese && Kana.containsJapanese(opt);
      const b = h('button.option' + (jp ? '.jp-opt' : '') + (jp && opt.length <= 3 ? '.short' : ''), { type: 'button', onclick: () => selectOption(i) },
        h('span.opt-n', String(i + 1)), h('span.opt-text', { lang: jp ? 'ja' : null }, opt));
      optionButtons.push(b);
      list.append(b);
    });
    body.append(list);
  }

  function selectOption(idx) {
    if (answered) return;
    selected = idx;
    optionButtons.forEach((b, i) => b.classList.toggle('selected', i === idx));
    mainBtn.disabled = false;
  }

  function buildTyping() {
    const preview = h('div.typing-preview', { lang: 'ja' }, '→ ');
    input = h('input.typing-input', {
      type: 'text', lang: 'ja', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      enterkeyhint: 'done', placeholder: 'romaji ou かな',
    });
    input.addEventListener('input', () => {
      preview.textContent = '→ ' + Kana.romajiToHiragana(input.value, false);
      mainBtn.disabled = input.value.trim().length === 0;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); mainAction(); } });
    body.append(input, preview);
    if (cur.hint) {
      const hint = h('button.btn.soft.small', { type: 'button' }, '💡 Dica');
      hint.onclick = () => { hint.replaceChildren(jpSpan(cur.hint)); hint.disabled = true; input.focus(); };
      body.append(hint);
    }
  }

  function buildOrder() {
    answerArea = h('div.tile-area.answer');
    bankArea = h('div.tile-area.bank');
    body.append(h('div.muted.small', 'Sua frase:'), answerArea, h('div.muted.small', 'Peças:'), bankArea);
    for (const t of cur.tiles) {
      const tile = h('button.word-tile', { type: 'button', lang: 'ja' }, t);
      tile.onclick = () => {
        if (answered) return;
        (tile.parentElement === bankArea ? answerArea : bankArea).append(tile);
        mainBtn.disabled = answerArea.children.length === 0;
      };
      bankArea.append(tile);
    }
  }

  function mainAction() {
    if (finished) return;
    if (!answered) { if (!mainBtn.disabled) check(); } else next();
  }

  function check() {
    let correct = false;
    let lenient = false;
    if (cur.type === 'choice' || cur.type === 'listen') {
      if (selected < 0) return;
      correct = selected === cur.answer;
      optionButtons.forEach((b, i) => {
        b.classList.remove('selected');
        if (i === cur.answer) b.classList.add('right');
        else if (i === selected) b.classList.add('wrong');
        b.disabled = true;
      });
    } else if (cur.type === 'typing') {
      const user = input.value;
      for (const acc of cur.accepted) {
        const r = Kana.compare(user, acc);
        if (r === 'exact') { correct = true; lenient = false; break; }
        if (r === 'lenient') { correct = true; lenient = true; }
      }
      input.readOnly = true;
      input.classList.add(correct ? 'right' : 'wrong');
      input.blur();
    } else if (cur.type === 'order') {
      const built = [...answerArea.children].map((c) => c.textContent).join('');
      const target = cur.correct.join('');
      correct = Kana.normalizeAnswer(built) === Kana.normalizeAnswer(target) || built.replaceAll(' ', '') === target.replaceAll(' ', '');
      answerArea.classList.add(correct ? 'right' : 'wrong');
    }

    answered = true;
    const firstTime = !failed.has(cur) && !retried.has(cur);
    if (correct) {
      if (firstTime) firstTryCorrect++;
      Store.recordHit(cur.statKey);
    } else {
      Store.recordMistake(cur.statKey);
      if (firstTime) {
        failed.add(cur);
        const again = cloneForRetry(cur);
        retried.add(again);
        queue.push(again);
        counter.textContent = `${pos + 1} / ${queue.length}`;
      }
    }
    showFeedback(correct, lenient);
  }

  function showFeedback(correct, lenient) {
    foot.className = 'runner-foot ' + (correct ? 'ok' : 'bad');
    fbTitle.textContent = correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Não foi dessa vez…';
    const lines = [];
    if (!correct) {
      const ans = correctAnswerText(cur);
      let line = 'Resposta certa: ' + ans;
      if (Store.settings.ShowRomaji && Kana.isAllKana(ans.replaceAll(' ', '')) && cur.type !== 'order') line += `  (${Kana.toRomaji(ans)})`;
      lines.push(line);
    }
    if (lenient) lines.push('Obs.: as partículas は, へ, を se escrevem ha, he, wo (lidas wa, e, o).');
    if (cur.explanation) lines.push(cur.explanation);
    fbText.replaceChildren(...lines.flatMap((l, i) => (i ? [h('br'), jpSpan(l)] : [jpSpan(l)])));
    fbSpeak.hidden = !(Speech.available && cur.speakText);
    setMain('Continuar', correct ? 'success' : 'danger', true);
    mainBtn.focus({ preventScroll: true });
    navigator.vibrate?.(correct ? 12 : [30, 40, 30]);
    if (Speech.available && cur.speakText && (cur.type === 'order' || cur.audioRevealsAnswer || cur.japanese == null)) Speech.speak(cur.speakText);
  }

  function next() {
    pos++;
    if (pos >= queue.length) finish();
    else showExercise();
  }

  function finish() {
    finished = true;
    Speech.stop();
    progressFill.style.width = '100%';
    foot.hidden = true;
    const pct = Math.round((100 * firstTryCorrect) / Math.max(1, originalCount));
    const mistakes = [...failed];
    const extra = onComplete?.({ correct: firstTryCorrect, total: originalCount, percent: pct, mistakes });
    Store.save();

    const face = pct >= 90 ? '素晴らしい！' : pct >= 70 ? 'よくできました！' : pct >= 50 ? 'もう少し！' : 'がんばって！';
    const msg = pct >= 90 ? 'Excelente! Você dominou este conteúdo.'
      : pct >= 70 ? 'Muito bom! Conteúdo aprovado.'
        : pct >= 50 ? 'Quase lá. Revise a teoria e tente de novo.'
          : 'Vale revisar a teoria antes de tentar de novo — errar faz parte!';
    body.replaceChildren(
      h('div.finish',
        h('div.finish-face' + (pct >= 70 ? '.ok' : ''), { lang: 'ja' }, face),
        h('div.finish-score', `${pct}%`),
        h('div.muted', `${firstTryCorrect} de ${originalCount} certas de primeira · ${msg}`),
        extra ? h('div.finish-extra', extra) : null,
        h('div.btn-row.center',
          h('button.btn.primary', { type: 'button', onclick: onExit }, 'Concluir'),
          h('button.btn', { type: 'button', onclick: start }, 'Repetir exercícios'))),
      mistakes.length ? section('Revise o que você errou') : null,
      ...mistakes.map((m) => {
        const q = m.japanese ? `${m.prompt}  ${m.japanese}` : m.prompt;
        return sentenceCard(correctAnswerText(m), '', q + (m.explanation ? '\n' + m.explanation : ''));
      }));
    body.scrollTop = 0;
  }

  start();
  return { el: root, requestExit, isActive: () => !finished && pos > 0 };
}

function cloneForRetry(e) {
  const c = { ...e, tiles: shuffle(e.tiles) };
  if (e.options.length > 0) {
    const correct = e.options[e.answer];
    c.options = shuffle(e.options);
    c.answer = c.options.indexOf(correct);
  }
  return c;
}
