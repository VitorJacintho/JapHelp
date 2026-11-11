// Testes automáticos do app de celular. Abra /mobile/testes/ no navegador (o GitHub também roda antes de publicar).
// Não grava nada no progresso do aparelho.
import * as Kana from '../js/kana.js';
import { Content, vocabItems } from '../js/content.js';
import { CONTENT_FILES } from '../js/arquivos.js';
import { Store, toIso, parseDate, today } from '../js/store.js';
import * as Ex from '../js/exercises.js';
import { alignFurigana } from '../js/furigana.js';
import { loadStrokeData, checkDrawing, pathPoints } from '../js/strokes.js';
import { segment, conjugations, wordsWithFurigana } from '../js/glossary.js';
import { xpHistory, reviewForecast } from '../js/stats-data.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

class Falha extends Error {}
function assert(cond, msg) { if (!cond) throw new Falha(msg); }
/** Compara listas de casos; junta até 8 diferenças na mensagem. */
function cases(list, fn) {
  const diffs = [];
  for (const c of list) {
    const d = fn(c);
    if (d) diffs.push(d);
  }
  assert(diffs.length === 0, `${diffs.length} de ${list.length} diferentes:\n    ` + diffs.slice(0, 8).join('\n    '));
  return list.length;
}
const show = (v) => JSON.stringify(v);

// ---------------------------------------------------------------- paridade com o app de PC
const paridade = await (await fetch('paridade.json', { cache: 'no-store' })).json();
const compareName = { wrong: 'Wrong', exact: 'Exact', lenient: 'ParticleLenient' };

test('PC = celular: romaji → hiragana', () => cases(paridade.romajiToHiragana, ([i, o]) => {
  const g = Kana.romajiToHiragana(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: romaji → hiragana (digitando)', () => cases(paridade.romajiToHiraganaParcial, ([i, o]) => {
  const g = Kana.romajiToHiragana(i, false); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: kana → romaji', () => cases(paridade.toRomaji, ([i, o]) => {
  const g = Kana.toRomaji(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: → hiragana', () => cases(paridade.toHiragana, ([i, o]) => {
  const g = Kana.toHiragana(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: → katakana', () => cases(paridade.toKatakana, ([i, o]) => {
  const g = Kana.toKatakana(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: normalização da resposta', () => cases(paridade.normalizeAnswer, ([i, o]) => {
  const g = Kana.normalizeAnswer(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: busca sem acentos', () => cases(paridade.fold, ([i, o]) => {
  const g = Kana.fold(i); return g === o ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: divisão em kana (きゃ = 1)', () => cases(paridade.splitUnits, ([i, o]) => {
  const g = Kana.splitUnits(i); return show(g) === show(o) ? null : `${show(i)} → ${show(g)} (PC: ${show(o)})`;
}));
test('PC = celular: correção de respostas', () => cases(paridade.compare, ([u, e, o]) => {
  const g = compareName[Kana.compare(u, e)]; return g === o ? null : `${show(u)} × ${show(e)} → ${g} (PC: ${o})`;
}));
test('PC = celular: revisão espaçada (SRS)', () => cases(paridade.srs, ([box, grade, newBox, days]) => {
  const item = { Box: box, Reviews: 0, Lapses: 0, Due: '' };
  Store.grade(item, grade); // só mexe no objeto, não salva
  const d = grade === 0 ? -1 : Math.round((parseDate(item.Due) - today()) / 86400000);
  return item.Box === newBox && d === days ? null : `caixa ${box}, nota ${grade} → caixa ${item.Box}, ${d} dias (PC: caixa ${newBox}, ${days} dias)`;
}));

// ---------------------------------------------------------------- conteúdo
await Content.load();

test('Conteúdo carrega sem erros', () => {
  assert(Content.errors.length === 0, Content.errors.join('\n    '));
  assert(Content.modules.length > 0 && Content.allLessons.length > 0, 'nenhuma lição');
  assert(Content.kanji.length > 0 && Content.decks.length > 0 && Content.phrases.length > 0, 'faltam kanji, decks ou frases');
  return `${Content.allLessons.length} lições, ${Content.kanji.length} kanji, ${Content.decks.length} decks`;
});
test('Lições com id único e título', () => {
  const ids = Content.allLessons.map((l) => l.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(dup.length === 0, 'ids repetidos: ' + dup.join(', '));
  const semTitulo = Content.allLessons.filter((l) => !l.id || !l.title).map((l) => l.id || '(sem id)');
  assert(semTitulo.length === 0, 'sem id/título: ' + semTitulo.join(', '));
  return ids.length;
});
test('Exercícios de todas as lições são gerados e têm resposta', () => {
  const problems = [];
  let n = 0;
  for (const l of Content.allLessons) {
    let list;
    try { list = Ex.forLesson(l); } catch (e) { problems.push(`${l.id}: ${e.message}`); continue; }
    if (!list.length) problems.push(`${l.id}: nenhum exercício`);
    for (const ex of list) {
      n++;
      if ((ex.type === 'choice' || ex.type === 'listen') && !(ex.answer >= 0 && ex.answer < ex.options.length)) problems.push(`${l.id}: escolha sem a resposta certa (${ex.prompt})`);
      if (ex.type === 'typing' && !ex.accepted.length) problems.push(`${l.id}: digitação sem resposta (${ex.prompt})`);
      if (ex.type === 'order' && !ex.correct.length) problems.push(`${l.id}: montar frase sem peças (${ex.prompt})`);
      if (!Ex.correctAnswerText(ex)) problems.push(`${l.id}: resposta vazia (${ex.prompt})`);
    }
  }
  assert(problems.length === 0, problems.slice(0, 8).join('\n    '));
  return `${n} exercícios`;
});
test('Quizzes de kana, kanji, decks e frases', () => {
  const kana = Ex.kanaDrill(Kana.GojuonRows.flatMap((r) => r[1]).filter(Boolean), 20);
  assert(kana.length === 20, 'quiz de kana deveria ter 20 questões');
  for (const lvl of new Set(Content.kanji.map((k) => k.level))) {
    assert(Ex.kanjiDrill(Content.kanji.filter((k) => k.level === lvl).slice(0, 10)).length > 0, 'quiz de kanji vazio em ' + lvl);
  }
  for (const d of Content.decks) assert(Ex.vocabDrill(d.items, Math.min(20, d.items.length), Content.allVocab).length > 0, 'deck sem quiz: ' + d.name);
  for (const c of Content.phrases) assert(Ex.phraseDrill(c.items, Math.min(15, c.items.length)).length > 0, 'frases sem quiz: ' + c.name);
});

// ---------------------------------------------------------------- furigana
test('Furigana: casos conhecidos', () => cases([
  ['日本語を話します', 'にほんごを はなします', '日本語[にほんご]を話[はな]します'],
  ['食べます', 'たべます', '食[た]べます'],
  ['お母さん', 'おかあさん', 'お母[かあ]さん'],
  ['昨日、映画を見ました。', 'きのう、 えいがを みました。', '昨日[きのう]、映画[えいが]を見[み]ました。'],
  ['Suicaでお願いします。', 'スイカで おねがいします。', 'Suica[スイカ]でお願[ねが]いします。'],
  ['3時', 'さんじ', '3時[さんじ]'],
], ([jp, rd, want]) => {
  const got = alignFurigana(jp, rd)?.map((p) => (p.reading ? `${p.text}[${p.reading}]` : p.text)).join('') ?? 'null';
  return got === want ? null : `${jp} → ${got} (esperado ${want})`;
}));
test('Furigana: todo o conteúdo com kanji se encaixa', () => {
  const pairs = [];
  for (const l of Content.allLessons) {
    for (const v of vocabItems(l)) pairs.push([v.jp, v.reading]);
    for (const e of [...l.examples, ...l.text]) if (e.length >= 2 && e[1]) pairs.push([e[0], e[1]]);
    for (const d of l.dialog) if (d.length >= 3 && d[2]) pairs.push([d[1], d[2]]);
  }
  for (const d of Content.decks) for (const v of d.items) pairs.push([v.jp, v.reading]);
  for (const v of Content.phraseItems()) pairs.push([v.jp, v.reading]);
  for (const k of Content.kanji) for (const w of k.words) pairs.push([w.jp, w.reading]);
  const withKanji = pairs.filter(([j, r]) => Kana.containsKanji(j) && r && r !== j);
  assert(withKanji.length > 1000, 'conteúdo com kanji não encontrado');
  return cases(withKanji, ([j, r]) => {
    const parts = alignFurigana(j, r);
    if (!parts) return `${j} | ${r}`;
    if (parts.some((p) => p.reading && /[、。！？]/.test(p.reading))) return `pontuação na leitura: ${j}`;
    return null;
  });
});

// ---------------------------------------------------------------- ordem dos traços
const strokeData = await loadStrokeData();

test('Traços: todo kanji do curso e todo kana têm dados', () => {
  const need = new Set([...Content.kanji.map((k) => k.char)]);
  for (const rows of [Kana.GojuonRows, Kana.DakutenRows]) for (const [, ks] of rows) for (const k of ks) if (k) { need.add(k); need.add(Kana.toKatakana(k)); }
  const missing = [...need].filter((c) => !strokeData[c]);
  assert(missing.length === 0, 'sem dados: ' + missing.join(' ') + ' (rode mobile/ferramentas/kanjivg.ps1)');
  return `${need.size} caracteres`;
});
test('Traços: desenho certo passa, invertido e fora de ordem são apontados', () => {
  const chars = Object.keys(strokeData);
  const problems = [];
  for (const c of chars) {
    const ref = strokeData[c].map((d) => pathPoints(d));
    if (!checkDrawing(strokeData[c], ref).ok) problems.push(`${c}: desenho exato não passou`);
    const small = ref.map((s) => s.map(([x, y]) => [12 + x * 0.6, 20 + y * 0.6]));
    if (!checkDrawing(strokeData[c], small).ok) problems.push(`${c}: desenho menor (de memória) não passou`);
    if (ref.length >= 2 && checkDrawing(strokeData[c], [ref[1], ref[0], ...ref.slice(2)]).ok) problems.push(`${c}: ordem trocada passou`);
    if (checkDrawing(strokeData[c], ref.slice(0, -1)).ok) problems.push(`${c}: faltando traço passou`);
  }
  assert(problems.length === 0, problems.slice(0, 8).join('\n    '));
  return `${chars.length} caracteres`;
});
test('Traços: sentido invertido é apontado', () => {
  const ref = strokeData['一'].map((d) => pathPoints(d));
  const r = checkDrawing(strokeData['一'], [[...ref[0]].reverse()]);
  assert(!r.ok && r.results[0].issue === 'direction', 'esperado "sentido invertido" no 一');
});

test('PC = celular: furigana', () => cases(paridade.furigana, ([jp, rd, want]) => {
  const got = alignFurigana(jp, rd)?.map((p) => (p.reading ? `${p.text}[${p.reading}]` : p.text)).join('') ?? null;
  return got === want ? null : `${jp} | ${rd} → ${got} (PC: ${want})`;
}));
test('PC = celular: conferência dos traços', () => cases(paridade.tracos, ([ch, variant, want]) => {
  const ref = strokeData[ch].map((d) => pathPoints(d));
  const strokes = {
    exato: ref,
    pequeno: ref.map((s) => s.map(([x, y]) => [12 + x * 0.6, 20 + y * 0.6])),
    invertido: ref.map((s, i) => (i === 0 ? [...s].reverse() : s)),
    faltando: ref.slice(0, -1),
    trocado: [ref[1], ref[0], ...ref.slice(2)],
  }[variant];
  const r = checkDrawing(strokeData[ch], strokes);
  const name = { direction: 'Direction', order: 'Order', shape: 'Shape', extra: 'Extra' };
  const res = r.ok ? 'ok' : r.results.map((x) => (x.ok ? 'None' : x.issue === 'order' ? `Order:${x.matches}` : name[x.issue])).join(',');
  const got = `${res}|${r.drawn}`;
  return got === want ? null : `${ch} ${variant} → ${got} (PC: ${want})`;
}));

// ---------------------------------------------------------------- tocar na palavra
test('Palavras: divisão das frases', () => cases([
  ['これはいくらですか。', 'これ|は|いくら|ですか|。'],
  ['毎朝パンを食べます。', '毎朝|パン|を|食べます|。'],
  ['ちょっと待ってください。', 'ちょっと|待ってください|。'],
  ['今、ご飯を食べています。', '今|、|ご飯|を|食べています|。'],
  ['机の上に本があります。', '机|の|上|に|本|が|あります|。'],
], ([jp, want]) => {
  const got = segment(jp).map((s) => jp.slice(s.start, s.end)).join('|');
  return got === want ? null : `${jp} → ${got} (esperado ${want})`;
}));
test('Palavras: formas conjugadas', () => cases([
  ['食べます', ['食べました', '食べて', '食べたい', '食べません']],
  ['書く', ['書きます', '書いて', '書いた', '書かない']],
  ['行く', ['行きます', '行って', '行った']],
  ['高い', ['高くない', '高かった', '高くて']],
  ['勉強する', ['勉強します', '勉強して', '勉強した']],
], ([jp, forms]) => {
  const c = conjugations(jp);
  const missing = forms.filter((f) => !c.has(f));
  return missing.length ? `${jp}: faltou ${missing.join(', ')}` : null;
}));
test('Palavras: a maior parte dos exemplos é tocável', () => {
  let tot = 0, cov = 0;
  for (const l of Content.allLessons) {
    for (const e of [...l.examples, ...l.dialog.map((d) => [d[1], d[2]])]) {
      if (!e[0]) continue;
      for (const w of wordsWithFurigana(e[0], e[1])) {
        const n = [...w.text].filter((c) => Kana.isKana(c) || Kana.isKanji(c)).length;
        tot += n;
        if (w.entries || w.particle || w.grammar) cov += n;
      }
    }
  }
  const pct = Math.round((100 * cov) / tot);
  assert(pct >= 80, `só ${pct}% do texto ficou tocável`);
  return `${pct}% do texto`;
});

// ---------------------------------------------------------------- estatísticas
test('Estatísticas: XP por dia e previsão de revisões', () => {
  const now = new Date(2026, 10, 11);
  const data = {
    DailyXp: { '2026-11-11': 30, '2026-11-10': 12, '2026-10-01': 99 },
    Srs: {
      a: { Due: '2026-11-01T00:00:00' }, // atrasada → hoje
      b: { Due: '2026-11-11T09:00:00' },
      c: { Due: '2026-11-13T00:00:00' },
      d: { Due: '2026-12-25T00:00:00' }, // fora dos 7 dias
    },
  };
  const hist = xpHistory(data, 28, now);
  assert(hist.length === 28 && hist[27].value === 30 && hist[26].value === 12, 'histórico de XP');
  assert(hist.reduce((s, p) => s + p.value, 0) === 42, 'XP fora do período entrou no gráfico');
  const f = reviewForecast(data, 7, now).map((p) => p.value);
  assert(show(f) === show([2, 0, 1, 0, 0, 0, 0]), 'previsão: ' + show(f));
});

// ---------------------------------------------------------------- progresso
test('Datas no formato do app de PC', () => {
  const d = new Date(2026, 0, 2, 3, 4, 5);
  assert(toIso(d) === '2026-01-02T03:04:05', 'toIso: ' + toIso(d));
  assert(+parseDate('2026-01-02T03:04:05') === +d, 'parseDate');
  assert(+parseDate('2026-01-02T03:04:05.1234567') === +d + 123, 'parseDate com fração (.NET)');
});
test('Exportar não altera o progresso salvo', () => {
  const before = localStorage.getItem('japhelp.progress.v1');
  const json = Store.exportJson();
  const back = JSON.parse(json);
  assert(typeof back.Xp === 'number' && back.Settings && back.Srs, 'formato do arquivo exportado');
  assert(localStorage.getItem('japhelp.progress.v1') === before, 'exportar mudou o progresso');
});

// ---------------------------------------------------------------- modo offline
test('Todos os arquivos do modo offline existem', async () => {
  const sw = await (await fetch('../sw.js', { cache: 'no-store' })).text();
  const list = (name) => JSON.parse(sw.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`))[1].replaceAll("'", '"').replace(/,\s*\]/, ']'));
  const files = [...list('APP_FILES'), ...list('CONTENT_FILES')];
  const bad = [];
  await Promise.all(files.map(async (f) => {
    const r = await fetch('../' + f.replace(/^\.\//, ''), { cache: 'no-store' });
    if (!r.ok) bad.push(`${f}: HTTP ${r.status}`);
  }));
  assert(bad.length === 0, bad.join('\n    ') + '\n    (um arquivo faltando quebra a instalação offline)');
  assert(CONTENT_FILES.length > 0 && CONTENT_FILES.every((f) => files.includes('../Content/' + f)), 'arquivos.js e sw.js com listas diferentes');
  return `${files.length} arquivos`;
});

// ---------------------------------------------------------------- rodar
const out = document.getElementById('saida');
const resumo = document.getElementById('resumo');
let ok = 0;
const lines = [];
for (const t of tests) {
  try {
    const info = await t.fn();
    ok++;
    lines.push(`✓ ${t.name}${info != null ? ` (${typeof info === 'number' ? info + ' casos' : info})` : ''}`);
  } catch (e) {
    lines.push(`✗ ${t.name}\n    ${e instanceof Falha ? e.message : e.stack || e}`);
  }
  out.textContent = lines.join('\n');
}
const passed = ok === tests.length;
resumo.textContent = `${passed ? 'RESULTADO: OK' : 'RESULTADO: FALHOU'} — ${ok} de ${tests.length} testes passaram`;
resumo.className = passed ? 'ok' : 'falhou';
document.title = (passed ? '✓ ' : '✗ ') + 'Testes do JapHelp';
document.body.dataset.resultado = passed ? 'ok' : 'falhou';
