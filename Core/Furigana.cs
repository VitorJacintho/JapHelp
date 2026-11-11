using System.Text.RegularExpressions;

namespace JapHelp.Core;

/// <summary>Um trecho da frase: o texto e, se for kanji, a leitura que vai em cima (furigana).</summary>
public record FuriganaPart(string Text, string? Reading);

/// <summary>
/// Furigana: descobre a leitura de cada trecho de kanji usando as partes em kana como âncora
/// ("日本語を話します" + "にほんごを はなします" → 日本語[にほんご] を 話[はな] します).
/// Mesma lógica do app de celular (mobile/js/furigana.js) — os testes de paridade conferem.
/// </summary>
public static class Furigana
{
    private static bool IsLatin(char c) =>
        (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
        (c >= 'Ａ' && c <= 'Ｚ') || (c >= 'ａ' && c <= 'ｚ') || (c >= '０' && c <= '９');
    private static bool IsLetter(char c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= 'Ａ' && c <= 'Ｚ') || (c >= 'ａ' && c <= 'ｚ');
    private static bool NeedsReading(char c) => Kana.IsKanji(c) || c == 'ヶ' || c == '〆' || IsLatin(c);
    private static string NoSpace(string s) => Regex.Replace(s, @"[\s　]", "");

    /// <summary>Divide a frase em trechos; null quando não dá para alinhar a leitura.</summary>
    public static List<FuriganaPart>? Align(string jp, string? reading)
    {
        if (string.IsNullOrEmpty(jp) || string.IsNullOrEmpty(reading)) return null;
        var orig = NoSpace(reading);
        var target = Kana.ToHiragana(orig); // mesmo tamanho que orig: dá para recortar a leitura original

        // trechos: k = kanji/número/latim, a = kana (âncora), o = outros (pontuação, espaço)
        var runs = new List<(char Kind, string Text)>();
        for (int i = 0; i < jp.Length; i++)
        {
            char c = jp[i];
            char kind = NeedsReading(c) ? 'k' : Kana.IsKana(c) ? 'a' : 'o';
            if (kind == 'o' && "-.・".Contains(c) && i > 0 && i + 1 < jp.Length && IsLatin(jp[i - 1]) && IsLatin(jp[i + 1])) kind = 'k';
            if (runs.Count > 0 && runs[^1].Kind == kind) runs[^1] = (kind, runs[^1].Text + c);
            else runs.Add((kind, c.ToString()));
        }
        if (!runs.Any(r => r.Kind == 'k')) return null;

        var pattern = string.Concat(runs.Select(r => r.Kind switch
        {
            'k' => "([^、。，．！？!?,.「」『』（）()]+?)", // leitura de kanji nunca tem pontuação
            'a' => Regex.Escape(Kana.ToHiragana(NoSpace(r.Text))),
            _ => NoSpace(r.Text) is { Length: > 0 } t ? $"(?:{Regex.Escape(t)})?" : "",
        }));
        Match m;
        try { m = Regex.Match(target, "^" + pattern + "$"); }
        catch (ArgumentException) { return null; }
        if (!m.Success) return null;

        bool sameLength = orig.Length == target.Length;
        int g = 1;
        var parts = new List<FuriganaPart>();
        foreach (var (kind, text) in runs)
        {
            if (kind != 'k') { parts.Add(new FuriganaPart(text, null)); continue; }
            var grp = m.Groups[g++];
            var rd = grp.Value;
            if (sameLength && text.Any(IsLetter)) rd = orig.Substring(grp.Index, grp.Length); // "Suica" → スイカ, não すいか
            parts.Add(new FuriganaPart(text, Kana.ToHiragana(rd) == Kana.ToHiragana(text) ? null : rd));
        }
        return parts;
    }
}
