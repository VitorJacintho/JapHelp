using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace JapHelp.Core;

/// <summary>
/// Gera respostas de referência do app de PC para os testes do app de celular conferirem que os dois
/// dão o mesmo resultado (conversão de kana, correção de respostas, SRS).
/// Uso: JapHelp.exe --paridade mobile/testes/paridade.json
/// </summary>
public static class Paridade
{
    public static int Run(string outputPath)
    {
        ContentRepository.Load();

        // Leituras reais do curso (lições, decks, frases e palavras de kanji), sem repetição.
        var items = ContentRepository.AllLessons.SelectMany(l =>
                l.VocabItems
                    .Concat(l.Examples.Where(e => e.Length >= 3).Select(e => new VocabItem(e[0], e[1], e[2], l.Id)))
                    .Concat(l.Dialog.Where(d => d.Length >= 4).Select(d => new VocabItem(d[1], d[2], d[3], l.Id))))
            .Concat(ContentRepository.Decks.SelectMany(d => d.Items))
            .Concat(ContentRepository.Phrases.SelectMany(c => c.Items))
            .Concat(ContentRepository.Kanji.SelectMany(k => k.Words))
            .ToList();
        var readings = Sample(items.Select(v => v.Reading).Distinct().OrderBy(s => s, StringComparer.Ordinal).ToList(), 900);
        var jps = Sample(items.Select(v => v.Jp).Distinct().OrderBy(s => s, StringComparer.Ordinal).ToList(), 400);
        var meanings = Sample(items.Select(v => v.Meaning).Distinct().OrderBy(s => s, StringComparer.Ordinal).ToList(), 300);

        var romajiInputs = new List<string>
        {
            "konnichiwa", "gakkou", "matcha", "kon'ya", "shinbun", "ko-hi-", "arigatou", "kitte", "ryokou", "tsukue",
            "jisho", "onna", "sennsei", "kyuu", "benkyou", "fakkusu", "wo", "nn", "n", "kanpai", "tyotto", "xtu", "ltsu",
            "Watashi wa", "DESU", "  sumimasen  ", "chotto matte", "vu", "fi", "ti", "di", "she", "je", "che", "tsa",
        };
        romajiInputs.AddRange(readings.Select(Kana.ToRomaji));

        var compares = new List<string[]>();
        foreach (var r in readings.Take(400))
        {
            compares.Add(new[] { Kana.ToRomaji(r), r });
            compares.Add(new[] { r.Replace('は', 'わ').Replace('を', 'お').Replace('へ', 'え'), r });
            compares.Add(new[] { Kana.ToKatakana(r), r });
            compares.Add(new[] { r + "x", r });
        }
        compares.Add(new[] { "konnichiwa", "こんにちは" });
        compares.Add(new[] { "ke-ki", "ケーキ" });
        compares.Add(new[] { "", "あ" });

        var srs = new List<int[]>();
        for (int box = 0; box < ProgressStore.Intervals.Length; box++)
            for (int grade = 0; grade <= 3; grade++)
            {
                var item = new SrsItem { Box = box };
                ProgressStore.Grade(item, grade);
                int days = grade == 0 ? -1 : (int)Math.Round((item.Due - DateTime.Today).TotalDays);
                srs.Add(new[] { box, grade, item.Box, days });
            }

        var opts = new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        var sb = new StringBuilder();
        sb.Append("{\n\"_sobre\": ").Append(JsonSerializer.Serialize("Gerado por JapHelp.exe --paridade. Não edite à mão.", opts));
        void Section(string name, IEnumerable<object> rows)
        {
            sb.Append(",\n").Append(JsonSerializer.Serialize(name, opts)).Append(": [\n");
            sb.Append(string.Join(",\n", rows.Select(r => JsonSerializer.Serialize(r, opts))));
            sb.Append("\n]");
        }
        Section("romajiToHiragana", romajiInputs.Distinct().Select(s => new[] { s, Kana.RomajiToHiragana(s) }));
        Section("romajiToHiraganaParcial", romajiInputs.Take(40).Select(s => new[] { s, Kana.RomajiToHiragana(s, false) }));
        Section("toRomaji", readings.Concat(jps).Distinct().Select(s => new[] { s, Kana.ToRomaji(s) }));
        Section("toHiragana", readings.Concat(jps).Distinct().Select(s => new[] { s, Kana.ToHiragana(s) }));
        Section("toKatakana", readings.Distinct().Select(s => new[] { s, Kana.ToKatakana(s) }));
        Section("normalizeAnswer", readings.Concat(romajiInputs.Take(60)).Distinct().Select(s => new[] { s, Kana.NormalizeAnswer(s) }));
        Section("fold", meanings.Select(s => new[] { s, Kana.Fold(s) }));
        Section("splitUnits", readings.Where(Kana.IsAllKana).Take(300).Select(s => new object[] { s, Kana.SplitUnits(s) }));
        Section("compare", compares.Select(c => new[] { c[0], c[1], Kana.Compare(c[0], c[1]).ToString() }));
        Section("srs", srs.Cast<object>());
        sb.Append("\n}\n");

        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
        File.WriteAllText(outputPath, sb.ToString(), new UTF8Encoding(false));
        return 0;
    }

    /// <summary>Pega até n itens espalhados pela lista (sempre os mesmos, para o arquivo não mudar à toa).</summary>
    private static List<string> Sample(List<string> list, int n)
    {
        if (list.Count <= n) return list;
        var step = (double)list.Count / n;
        return Enumerable.Range(0, n).Select(i => list[(int)(i * step)]).ToList();
    }
}
