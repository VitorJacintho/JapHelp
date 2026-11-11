// Conversões romaji ↔ kana e tabelas de hiragana/katakana (porte de Core/Kana.cs).

export const GojuonRows = [
  ['a', ['あ', 'い', 'う', 'え', 'お']],
  ['k', ['か', 'き', 'く', 'け', 'こ']],
  ['s', ['さ', 'し', 'す', 'せ', 'そ']],
  ['t', ['た', 'ち', 'つ', 'て', 'と']],
  ['n', ['な', 'に', 'ぬ', 'ね', 'の']],
  ['h', ['は', 'ひ', 'ふ', 'へ', 'ほ']],
  ['m', ['ま', 'み', 'む', 'め', 'も']],
  ['y', ['や', '', 'ゆ', '', 'よ']],
  ['r', ['ら', 'り', 'る', 'れ', 'ろ']],
  ['w', ['わ', '', '', '', 'を']],
  ['ん', ['ん', '', '', '', '']],
];

export const DakutenRows = [
  ['g', ['が', 'ぎ', 'ぐ', 'げ', 'ご']],
  ['z', ['ざ', 'じ', 'ず', 'ぜ', 'ぞ']],
  ['d', ['だ', 'ぢ', 'づ', 'で', 'ど']],
  ['b', ['ば', 'び', 'ぶ', 'べ', 'ぼ']],
  ['p', ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']],
];

export const YoonRows = [
  ['ky', ['きゃ', 'きゅ', 'きょ']],
  ['sh', ['しゃ', 'しゅ', 'しょ']],
  ['ch', ['ちゃ', 'ちゅ', 'ちょ']],
  ['ny', ['にゃ', 'にゅ', 'にょ']],
  ['hy', ['ひゃ', 'ひゅ', 'ひょ']],
  ['my', ['みゃ', 'みゅ', 'みょ']],
  ['ry', ['りゃ', 'りゅ', 'りょ']],
  ['gy', ['ぎゃ', 'ぎゅ', 'ぎょ']],
  ['j', ['じゃ', 'じゅ', 'じょ']],
  ['by', ['びゃ', 'びゅ', 'びょ']],
  ['py', ['ぴゃ', 'ぴゅ', 'ぴょ']],
];

const K2R = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'ゔ': 'vu',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho', 'しぇ': 'she',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho', 'ちぇ': 'che',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo', 'じぇ': 'je',
  'ぢゃ': 'ja', 'ぢゅ': 'ju', 'ぢょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo', 'ふゅ': 'fyu',
  'てぃ': 'ti', 'でぃ': 'di', 'とぅ': 'tu', 'どぅ': 'du', 'でゅ': 'dyu',
  'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo',
  'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo',
  'つぁ': 'tsa', 'つぃ': 'tsi', 'つぇ': 'tse', 'つぉ': 'tso',
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ゎ': 'wa',
  '。': '. ', '、': ', ', '？': '?', '！': '!', '「': '"', '」': '"', '・': ' ', '　': ' ', '〜': '~', '…': '...',
};

const code = (c) => c.charCodeAt(0);
export const isHiragana = (c) => c >= 'ぁ' && c <= 'ゟ';
export const isKatakana = (c) => (c >= 'ァ' && c <= 'ヺ') || c === 'ー' || c === 'ヽ' || c === 'ヾ';
export const isKana = (c) => isHiragana(c) || isKatakana(c);
export const isKanji = (c) => (c >= '一' && c <= '鿿') || (c >= '㐀' && c <= '䶿') || c === '々';
export const containsKanji = (s) => [...(s || '')].some(isKanji);
export const containsJapanese = (s) =>
  [...(s || '')].some((c) => isKana(c) || isKanji(c) || (c >= '　' && c <= '〿') || (c >= '＀' && c <= '￯'));
export const isAllKana = (s) => !!s && s.length > 0 && [...s].every((c) => isKana(c) || c === ' ' || c === '　');

export function toHiragana(s) {
  let out = '';
  for (const c of s || '') {
    if (c >= 'ァ' && c <= 'ヶ') out += String.fromCharCode(code(c) - 0x60);
    else if (c === 'ヴ') out += 'ゔ';
    else out += c;
  }
  return out;
}

export function toKatakana(s) {
  let out = '';
  for (const c of s || '') {
    if (c >= 'ぁ' && c <= 'ゖ') out += String.fromCharCode(code(c) + 0x60);
    else out += c;
  }
  return out;
}

const TRAIL = '。、？！?!.,';

/** Converte kana em romaji (Hepburn). Palavras separadas por espaço: は/へ/を isolados viram wa/e/o. */
export function toRomaji(text) {
  if (!text) return '';
  const tokens = text.split(/[ 　]+/).filter((t) => t.length > 0);
  const parts = [];
  for (const tok of tokens) {
    let end = tok.length;
    while (end > 0 && TRAIL.includes(tok[end - 1])) end--;
    const t = tok.slice(0, end);
    const tail = tok.slice(end);
    const r = t === 'は' ? 'wa' : t === 'へ' ? 'e' : t === 'を' ? 'o' : convertToken(t);
    parts.push(r + convertToken(tail).trimEnd());
  }
  return parts.join(' ').replaceAll(' .', '.').replaceAll(' ,', ',').trim();
}

function convertToken(token) {
  const s = toHiragana(token);
  let sb = '';
  let geminate = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'っ') { geminate = true; continue; }
    if (c === 'ー') {
      for (let k = sb.length - 1; k >= 0; k--) {
        if ('aeiou'.includes(sb[k])) { sb += sb[k]; break; }
      }
      continue;
    }
    let rom = null;
    if (i + 1 < s.length && K2R[s.substr(i, 2)] !== undefined) {
      rom = K2R[s.substr(i, 2)];
      i++;
    } else if (K2R[c] !== undefined) {
      rom = K2R[c];
    }
    if (rom === null) {
      if (geminate) { sb += 'っ'; geminate = false; }
      sb += c;
      continue;
    }
    if (geminate) {
      if (rom.startsWith('ch')) sb += 't';
      else if (rom.length > 0 && /[a-z]/i.test(rom[0]) && !'aeiou'.includes(rom[0])) sb += rom[0];
      geminate = false;
    }
    if (rom === 'n' && i + 1 < s.length) {
      const nr = K2R[s[i + 1]];
      if (nr && nr.length > 0 && 'aeiouy'.includes(nr[0])) rom = "n'";
    }
    sb += rom;
  }
  return sb;
}

// ---------- romaji -> hiragana ----------
const R2K = (() => {
  const m = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    ca: 'か', cu: 'く', co: 'こ', qa: 'くぁ',
    sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ', ye: 'いぇ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
    wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', fyu: 'ふゅ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ',
    sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ',
    tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ',
    jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
    tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
    thi: 'てぃ', dhi: 'でぃ', twu: 'とぅ', dwu: 'どぅ', dyu: 'でゅ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
    xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtu: 'っ', xtsu: 'っ', xwa: 'ゎ',
    nn: 'ん', "n'": 'ん', xn: 'ん',
  };
  for (const [c, k] of [['k', 'き'], ['n', 'に'], ['h', 'ひ'], ['m', 'み'], ['r', 'り'], ['g', 'ぎ'], ['b', 'び'], ['p', 'ぴ']]) {
    m[c + 'ya'] = k + 'ゃ';
    m[c + 'yu'] = k + 'ゅ';
    m[c + 'yo'] = k + 'ょ';
    m[c + 'ye'] = k + 'ぇ';
  }
  return m;
})();

const isVowel = (c) => 'aeiou'.includes(c) && c !== '';
const isLetter = (c) => /\p{L}/u.test(c);
const PUNCT = { '-': 'ー', '.': '。', ',': '、', '?': '？', '!': '！', '~': '〜' };

/** Converte romaji digitado em hiragana (estilo IME, aceita Hepburn: "konnichiwa"). */
export function romajiToHiragana(input, finalize = true) {
  const s = (input || '').toLowerCase();
  let sb = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === 'n') {
      const n1 = i + 1 < s.length ? s[i + 1] : '';
      const n2 = i + 2 < s.length ? s[i + 2] : '';
      if (n1 === "'") { sb += 'ん'; i += 2; continue; }
      if (n1 === 'n') {
        if (isVowel(n2) || n2 === 'y') { sb += 'ん'; i += 1; continue; }
        sb += 'ん'; i += 2; continue;
      }
      if (n1 === '') {
        sb += finalize ? 'ん' : 'n';
        i++; continue;
      }
      if (!isVowel(n1) && n1 !== 'y') { sb += 'ん'; i++; continue; }
    }
    if (i + 1 < s.length && c === s[i + 1] && isLetter(c) && !isVowel(c) && c !== 'n') {
      sb += 'っ'; i++; continue;
    }
    if (c === 't' && i + 2 < s.length && s[i + 1] === 'c' && s[i + 2] === 'h') {
      sb += 'っ'; i++; continue;
    }
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      if (i + len > s.length) continue;
      const sub = s.substr(i, len);
      if (R2K[sub] !== undefined) {
        sb += R2K[sub];
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    sb += PUNCT[c] ?? c;
    i++;
  }
  return sb;
}

// ---------- comparação de respostas ----------
const IGNORE = '。、？！?!.,「」・〜~…\'"';

/** Normaliza: romaji vira kana, katakana vira hiragana, remove pontuação e espaços. */
export function normalizeAnswer(s) {
  if (!s || !s.trim()) return '';
  s = s.trim().normalize('NFKC');
  if (/[a-zA-Z]/.test(s)) s = romajiToHiragana(s);
  s = toHiragana(s);
  let sb = '';
  for (const c of s) {
    if (/\s/.test(c)) continue;
    if (IGNORE.includes(c)) continue;
    if (c === 'ー' && sb.length > 0) {
      const rom = convertToken(sb[sb.length - 1]);
      const v = rom.length > 0 ? rom[rom.length - 1] : ' ';
      sb += { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' }[v] ?? 'ー';
      continue;
    }
    sb += c;
  }
  return sb;
}

/** 'wrong' | 'exact' | 'lenient' — aceita わ/え/お no lugar das partículas は/へ/を. */
export function compare(user, expected) {
  const u = normalizeAnswer(user);
  const e = normalizeAnswer(expected);
  if (u.length === 0) return 'wrong';
  if (u === e) return 'exact';
  if (u.length !== e.length) return 'wrong';
  let lenient = false;
  for (let i = 0; i < u.length; i++) {
    if (u[i] === e[i]) continue;
    if ((e[i] === 'は' && u[i] === 'わ') || (e[i] === 'へ' && u[i] === 'え') || (e[i] === 'を' && u[i] === 'お')) {
      lenient = true;
      continue;
    }
    return 'wrong';
  }
  return lenient ? 'lenient' : 'wrong';
}

/** Remove acentos e baixa caixa — para busca em português. */
export const fold = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC');

/** Divide uma string de kana em unidades (きゃ conta como uma). */
export function splitUnits(s) {
  const small = 'ゃゅょャュョぁぃぅぇぉァィゥェォ';
  const list = [];
  for (const part of (s || '').split(' ').filter((p) => p.length > 0)) {
    let i = 0;
    while (i < part.length) {
      if (i + 1 < part.length && small.includes(part[i + 1])) {
        list.push(part.substr(i, 2));
        i += 2;
      } else {
        list.push(part[i]);
        i++;
      }
    }
  }
  return [...new Set(list)];
}
