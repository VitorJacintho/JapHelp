using System.Globalization;
using System.Text;

namespace JapHelp.Core;

/// <summary>Conversões romaji ↔ kana e tabelas de hiragana/katakana.</summary>
public static class Kana
{
    // ---------- Tabelas para exibição ----------
    public static readonly (string Row, string[] Kana)[] GojuonRows =
    {
        ("a",  new[] { "あ", "い", "う", "え", "お" }),
        ("k",  new[] { "か", "き", "く", "け", "こ" }),
        ("s",  new[] { "さ", "し", "す", "せ", "そ" }),
        ("t",  new[] { "た", "ち", "つ", "て", "と" }),
        ("n",  new[] { "な", "に", "ぬ", "ね", "の" }),
        ("h",  new[] { "は", "ひ", "ふ", "へ", "ほ" }),
        ("m",  new[] { "ま", "み", "む", "め", "も" }),
        ("y",  new[] { "や", "", "ゆ", "", "よ" }),
        ("r",  new[] { "ら", "り", "る", "れ", "ろ" }),
        ("w",  new[] { "わ", "", "", "", "を" }),
        ("ん", new[] { "ん", "", "", "", "" }),
    };

    public static readonly (string Row, string[] Kana)[] DakutenRows =
    {
        ("g", new[] { "が", "ぎ", "ぐ", "げ", "ご" }),
        ("z", new[] { "ざ", "じ", "ず", "ぜ", "ぞ" }),
        ("d", new[] { "だ", "ぢ", "づ", "で", "ど" }),
        ("b", new[] { "ば", "び", "ぶ", "べ", "ぼ" }),
        ("p", new[] { "ぱ", "ぴ", "ぷ", "ぺ", "ぽ" }),
    };

    public static readonly (string Row, string[] Kana)[] YoonRows =
    {
        ("ky", new[] { "きゃ", "きゅ", "きょ" }),
        ("sh", new[] { "しゃ", "しゅ", "しょ" }),
        ("ch", new[] { "ちゃ", "ちゅ", "ちょ" }),
        ("ny", new[] { "にゃ", "にゅ", "にょ" }),
        ("hy", new[] { "ひゃ", "ひゅ", "ひょ" }),
        ("my", new[] { "みゃ", "みゅ", "みょ" }),
        ("ry", new[] { "りゃ", "りゅ", "りょ" }),
        ("gy", new[] { "ぎゃ", "ぎゅ", "ぎょ" }),
        ("j",  new[] { "じゃ", "じゅ", "じょ" }),
        ("by", new[] { "びゃ", "びゅ", "びょ" }),
        ("py", new[] { "ぴゃ", "ぴゅ", "ぴょ" }),
    };

    // ---------- kana -> romaji ----------
    private static readonly Dictionary<string, string> KanaToRomajiMap = new()
    {
        ["あ"]="a",["い"]="i",["う"]="u",["え"]="e",["お"]="o",
        ["か"]="ka",["き"]="ki",["く"]="ku",["け"]="ke",["こ"]="ko",
        ["さ"]="sa",["し"]="shi",["す"]="su",["せ"]="se",["そ"]="so",
        ["た"]="ta",["ち"]="chi",["つ"]="tsu",["て"]="te",["と"]="to",
        ["な"]="na",["に"]="ni",["ぬ"]="nu",["ね"]="ne",["の"]="no",
        ["は"]="ha",["ひ"]="hi",["ふ"]="fu",["へ"]="he",["ほ"]="ho",
        ["ま"]="ma",["み"]="mi",["む"]="mu",["め"]="me",["も"]="mo",
        ["や"]="ya",["ゆ"]="yu",["よ"]="yo",
        ["ら"]="ra",["り"]="ri",["る"]="ru",["れ"]="re",["ろ"]="ro",
        ["わ"]="wa",["ゐ"]="wi",["ゑ"]="we",["を"]="wo",["ん"]="n",
        ["が"]="ga",["ぎ"]="gi",["ぐ"]="gu",["げ"]="ge",["ご"]="go",
        ["ざ"]="za",["じ"]="ji",["ず"]="zu",["ぜ"]="ze",["ぞ"]="zo",
        ["だ"]="da",["ぢ"]="ji",["づ"]="zu",["で"]="de",["ど"]="do",
        ["ば"]="ba",["び"]="bi",["ぶ"]="bu",["べ"]="be",["ぼ"]="bo",
        ["ぱ"]="pa",["ぴ"]="pi",["ぷ"]="pu",["ぺ"]="pe",["ぽ"]="po",
        ["ゔ"]="vu",
        ["きゃ"]="kya",["きゅ"]="kyu",["きょ"]="kyo",
        ["しゃ"]="sha",["しゅ"]="shu",["しょ"]="sho",["しぇ"]="she",
        ["ちゃ"]="cha",["ちゅ"]="chu",["ちょ"]="cho",["ちぇ"]="che",
        ["にゃ"]="nya",["にゅ"]="nyu",["にょ"]="nyo",
        ["ひゃ"]="hya",["ひゅ"]="hyu",["ひょ"]="hyo",
        ["みゃ"]="mya",["みゅ"]="myu",["みょ"]="myo",
        ["りゃ"]="rya",["りゅ"]="ryu",["りょ"]="ryo",
        ["ぎゃ"]="gya",["ぎゅ"]="gyu",["ぎょ"]="gyo",
        ["じゃ"]="ja",["じゅ"]="ju",["じょ"]="jo",["じぇ"]="je",
        ["ぢゃ"]="ja",["ぢゅ"]="ju",["ぢょ"]="jo",
        ["びゃ"]="bya",["びゅ"]="byu",["びょ"]="byo",
        ["ぴゃ"]="pya",["ぴゅ"]="pyu",["ぴょ"]="pyo",
        ["ふぁ"]="fa",["ふぃ"]="fi",["ふぇ"]="fe",["ふぉ"]="fo",["ふゅ"]="fyu",
        ["てぃ"]="ti",["でぃ"]="di",["とぅ"]="tu",["どぅ"]="du",["でゅ"]="dyu",
        ["うぃ"]="wi",["うぇ"]="we",["うぉ"]="wo",
        ["ゔぁ"]="va",["ゔぃ"]="vi",["ゔぇ"]="ve",["ゔぉ"]="vo",
        ["つぁ"]="tsa",["つぃ"]="tsi",["つぇ"]="tse",["つぉ"]="tso",
        ["ぁ"]="a",["ぃ"]="i",["ぅ"]="u",["ぇ"]="e",["ぉ"]="o",
        ["ゃ"]="ya",["ゅ"]="yu",["ょ"]="yo",["ゎ"]="wa",
        ["。"]=". ",["、"]=", ",["？"]="?",["！"]="!",["「"]="\"",["」"]="\"",["・"]=" ",["　"]=" ",["〜"]="~",["…"]="...",
    };

    public static bool IsHiragana(char c) => c >= 'ぁ' && c <= 'ゟ';
    public static bool IsKatakana(char c) => (c >= 'ァ' && c <= 'ヺ') || c == 'ー' || c == 'ヽ' || c == 'ヾ';
    public static bool IsKana(char c) => IsHiragana(c) || IsKatakana(c);
    public static bool IsKanji(char c) => (c >= '一' && c <= '鿿') || (c >= '㐀' && c <= '䶿') || c == '々';
    public static bool ContainsKanji(string s) => s.Any(IsKanji);
    public static bool ContainsJapanese(string s) => s.Any(c => IsKana(c) || IsKanji(c) || (c >= '　' && c <= '〿') || (c >= '＀' && c <= '￯'));
    public static bool IsAllKana(string s) => s.Length > 0 && s.All(c => IsKana(c) || c == ' ' || c == '　');

    public static string ToHiragana(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            if (c >= 'ァ' && c <= 'ヶ') sb.Append((char)(c - 0x60));
            else if (c == 'ヴ') sb.Append('ゔ');
            else sb.Append(c);
        }
        return sb.ToString();
    }

    public static string ToKatakana(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            if (c >= 'ぁ' && c <= 'ゖ') sb.Append((char)(c + 0x60));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    /// <summary>Converte kana em romaji (Hepburn). Palavras separadas por espaço: は/へ/を isolados viram partículas wa/e/o.</summary>
    public static string ToRomaji(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        var tokens = text.Split(new[] { ' ', '　' }, StringSplitOptions.RemoveEmptyEntries);
        var parts = new List<string>();
        foreach (var tok in tokens)
        {
            var t = tok.TrimEnd('。', '、', '？', '！', '?', '!', '.', ',');
            var tail = tok.Substring(t.Length);
            string r = t switch
            {
                "は" => "wa",
                "へ" => "e",
                "を" => "o",
                _ => ConvertToken(t)
            };
            parts.Add(r + ConvertToken(tail).TrimEnd());
        }
        return string.Join(" ", parts).Replace(" .", ".").Replace(" ,", ",").Trim();
    }

    private static string ConvertToken(string token)
    {
        var s = ToHiragana(token);
        var sb = new StringBuilder();
        bool geminate = false;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c == 'っ')
            {
                geminate = true;
                continue;
            }
            if (c == 'ー')
            {
                // repete a última vogal
                for (int k = sb.Length - 1; k >= 0; k--)
                {
                    if ("aeiou".Contains(sb[k])) { sb.Append(sb[k]); break; }
                }
                continue;
            }
            string? rom = null;
            if (i + 1 < s.Length && KanaToRomajiMap.TryGetValue(s.Substring(i, 2), out var two))
            {
                rom = two;
                i++;
            }
            else if (KanaToRomajiMap.TryGetValue(c.ToString(), out var one))
            {
                rom = one;
            }

            if (rom == null)
            {
                if (geminate) { sb.Append('っ'); geminate = false; }
                sb.Append(c);
                continue;
            }

            if (geminate)
            {
                if (rom.StartsWith("ch")) sb.Append('t');
                else if (rom.Length > 0 && char.IsLetter(rom[0]) && !"aeiou".Contains(rom[0])) sb.Append(rom[0]);
                geminate = false;
            }

            // ん antes de vogal ou y: n'
            if (rom == "n" && i + 1 < s.Length)
            {
                var next = s[i + 1].ToString();
                if (KanaToRomajiMap.TryGetValue(next, out var nr) && nr.Length > 0 && ("aeiouy".Contains(nr[0])))
                    rom = "n'";
            }
            sb.Append(rom);
        }
        return sb.ToString();
    }

    // ---------- romaji -> hiragana ----------
    private static readonly Dictionary<string, string> RomajiMap = BuildRomajiMap();

    private static Dictionary<string, string> BuildRomajiMap()
    {
        var m = new Dictionary<string, string>
        {
            ["a"]="あ",["i"]="い",["u"]="う",["e"]="え",["o"]="お",
            ["ka"]="か",["ki"]="き",["ku"]="く",["ke"]="け",["ko"]="こ",
            ["ca"]="か",["cu"]="く",["co"]="こ",["qa"]="くぁ",
            ["sa"]="さ",["shi"]="し",["si"]="し",["su"]="す",["se"]="せ",["so"]="そ",
            ["ta"]="た",["chi"]="ち",["ti"]="ち",["tsu"]="つ",["tu"]="つ",["te"]="て",["to"]="と",
            ["na"]="な",["ni"]="に",["nu"]="ぬ",["ne"]="ね",["no"]="の",
            ["ha"]="は",["hi"]="ひ",["fu"]="ふ",["hu"]="ふ",["he"]="へ",["ho"]="ほ",
            ["ma"]="ま",["mi"]="み",["mu"]="む",["me"]="め",["mo"]="も",
            ["ya"]="や",["yu"]="ゆ",["yo"]="よ",["ye"]="いぇ",
            ["ra"]="ら",["ri"]="り",["ru"]="る",["re"]="れ",["ro"]="ろ",
            ["la"]="ら",["li"]="り",["lu"]="る",["le"]="れ",["lo"]="ろ",
            ["wa"]="わ",["wo"]="を",["wi"]="うぃ",["we"]="うぇ",
            ["ga"]="が",["gi"]="ぎ",["gu"]="ぐ",["ge"]="げ",["go"]="ご",
            ["za"]="ざ",["ji"]="じ",["zi"]="じ",["zu"]="ず",["ze"]="ぜ",["zo"]="ぞ",
            ["da"]="だ",["di"]="ぢ",["du"]="づ",["de"]="で",["do"]="ど",
            ["ba"]="ば",["bi"]="び",["bu"]="ぶ",["be"]="べ",["bo"]="ぼ",
            ["pa"]="ぱ",["pi"]="ぴ",["pu"]="ぷ",["pe"]="ぺ",["po"]="ぽ",
            ["va"]="ゔぁ",["vi"]="ゔぃ",["vu"]="ゔ",["ve"]="ゔぇ",["vo"]="ゔぉ",
            ["fa"]="ふぁ",["fi"]="ふぃ",["fe"]="ふぇ",["fo"]="ふぉ",["fyu"]="ふゅ",
            ["sha"]="しゃ",["shu"]="しゅ",["sho"]="しょ",["she"]="しぇ",
            ["sya"]="しゃ",["syu"]="しゅ",["syo"]="しょ",
            ["cha"]="ちゃ",["chu"]="ちゅ",["cho"]="ちょ",["che"]="ちぇ",
            ["tya"]="ちゃ",["tyu"]="ちゅ",["tyo"]="ちょ",["cya"]="ちゃ",["cyu"]="ちゅ",["cyo"]="ちょ",
            ["ja"]="じゃ",["ju"]="じゅ",["jo"]="じょ",["je"]="じぇ",
            ["jya"]="じゃ",["jyu"]="じゅ",["jyo"]="じょ",["zya"]="じゃ",["zyu"]="じゅ",["zyo"]="じょ",
            ["tsa"]="つぁ",["tsi"]="つぃ",["tse"]="つぇ",["tso"]="つぉ",
            ["thi"]="てぃ",["dhi"]="でぃ",["twu"]="とぅ",["dwu"]="どぅ",["dyu"]="でゅ",
            ["xa"]="ぁ",["xi"]="ぃ",["xu"]="ぅ",["xe"]="ぇ",["xo"]="ぉ",
            ["xya"]="ゃ",["xyu"]="ゅ",["xyo"]="ょ",["xtu"]="っ",["xtsu"]="っ",["xwa"]="ゎ",
            ["nn"]="ん",["n'"]="ん",["xn"]="ん",
        };
        foreach (var (c, k) in new[] { ("k","き"),("n","に"),("h","ひ"),("m","み"),("r","り"),("g","ぎ"),("b","び"),("p","ぴ") })
        {
            m[c + "ya"] = k + "ゃ";
            m[c + "yu"] = k + "ゅ";
            m[c + "yo"] = k + "ょ";
            m[c + "ye"] = k + "ぇ";
        }
        return m;
    }

    private static bool IsVowel(char c) => "aeiou".Contains(c);

    /// <summary>Converte romaji digitado em hiragana (estilo IME, mas aceita Hepburn: "konnichiwa").</summary>
    public static string RomajiToHiragana(string input, bool finalize = true)
    {
        var s = input.ToLowerInvariant();
        var sb = new StringBuilder();
        int i = 0;
        while (i < s.Length)
        {
            char c = s[i];
            if (c == 'n')
            {
                char n1 = i + 1 < s.Length ? s[i + 1] : '\0';
                char n2 = i + 2 < s.Length ? s[i + 2] : '\0';
                if (n1 == '\'') { sb.Append('ん'); i += 2; continue; }
                if (n1 == 'n')
                {
                    if (IsVowel(n2) || n2 == 'y') { sb.Append('ん'); i += 1; continue; }
                    sb.Append('ん'); i += 2; continue;
                }
                if (n1 == '\0')
                {
                    if (finalize) sb.Append('ん'); else sb.Append('n');
                    i++; continue;
                }
                if (!IsVowel(n1) && n1 != 'y') { sb.Append('ん'); i++; continue; }
            }

            // consoante dobrada -> っ
            if (i + 1 < s.Length && c == s[i + 1] && char.IsLetter(c) && !IsVowel(c) && c != 'n')
            {
                sb.Append('っ');
                i++;
                continue;
            }
            if (c == 't' && i + 2 < s.Length && s[i + 1] == 'c' && s[i + 2] == 'h')
            {
                sb.Append('っ');
                i++;
                continue;
            }

            bool matched = false;
            for (int len = 4; len >= 1; len--)
            {
                if (i + len > s.Length) continue;
                var sub = s.Substring(i, len);
                if (RomajiMap.TryGetValue(sub, out var kana))
                {
                    sb.Append(kana);
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            sb.Append(c switch
            {
                '-' => 'ー',
                '.' => '。',
                ',' => '、',
                '?' => '？',
                '!' => '！',
                '~' => '〜',
                _ => c
            });
            i++;
        }
        return sb.ToString();
    }

    // ---------- Comparação de respostas ----------
    /// <summary>Normaliza texto para comparação: romaji vira kana, katakana vira hiragana, remove pontuação e espaços.</summary>
    public static string NormalizeAnswer(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        s = s.Trim().Normalize(NormalizationForm.FormKC);
        if (s.Any(ch => ch is >= 'a' and <= 'z' || ch is >= 'A' and <= 'Z'))
            s = RomajiToHiragana(s);
        s = ToHiragana(s);
        var sb = new StringBuilder();
        foreach (var c in s)
        {
            if (char.IsWhiteSpace(c)) continue;
            if ("。、？！?!.,「」・〜~…'\"".Contains(c)) continue;
            if (c == 'ー' && sb.Length > 0)
            {
                // traço longo = repetir a vogal anterior (けーき == けえき)
                var rom = ConvertToken(sb[^1].ToString());
                var v = rom.Length > 0 ? rom[^1] : ' ';
                var vowelKana = v switch { 'a' => 'あ', 'i' => 'い', 'u' => 'う', 'e' => 'え', 'o' => 'お', _ => 'ー' };
                sb.Append(vowelKana);
                continue;
            }
            sb.Append(c);
        }
        return sb.ToString();
    }

    public enum MatchResult { Wrong, Exact, ParticleLenient }

    /// <summary>Compara a resposta do aluno com uma esperada. Aceita わ/え/お no lugar das partículas は/へ/を.</summary>
    public static MatchResult Compare(string user, string expected)
    {
        var u = NormalizeAnswer(user);
        var e = NormalizeAnswer(expected);
        if (u.Length == 0) return MatchResult.Wrong;
        if (u == e) return MatchResult.Exact;
        if (u.Length != e.Length) return MatchResult.Wrong;
        bool lenient = false;
        for (int i = 0; i < u.Length; i++)
        {
            if (u[i] == e[i]) continue;
            if ((e[i] == 'は' && u[i] == 'わ') || (e[i] == 'へ' && u[i] == 'え') || (e[i] == 'を' && u[i] == 'お'))
            {
                lenient = true;
                continue;
            }
            return MatchResult.Wrong;
        }
        return lenient ? MatchResult.ParticleLenient : MatchResult.Wrong;
    }

    /// <summary>Remove acentos e baixa caixa — para busca em português.</summary>
    public static string Fold(string s)
    {
        var norm = s.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in norm)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>Divide uma string de kana em unidades (きゃ conta como uma).</summary>
    public static List<string> SplitUnits(string s)
    {
        const string small = "ゃゅょャュョぁぃぅぇぉァィゥェォ";
        var list = new List<string>();
        foreach (var part in s.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            int i = 0;
            while (i < part.Length)
            {
                if (i + 1 < part.Length && small.Contains(part[i + 1]))
                {
                    list.Add(part.Substring(i, 2));
                    i += 2;
                }
                else
                {
                    list.Add(part[i].ToString());
                    i++;
                }
            }
        }
        return list.Distinct().ToList();
    }
}
