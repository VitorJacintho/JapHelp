using System.Text;

namespace JapHelp.Core;

/// <summary>Verificação automática do conteúdo e do conversor (JapHelp.exe --selftest saida.txt).</summary>
public static class SelfTest
{
    public static int Run(string outputPath)
    {
        var sb = new StringBuilder();
        int problems = 0;
        void Fail(string msg) { problems++; sb.AppendLine("  ✗ " + msg); }

        // ---------- conversor ----------
        sb.AppendLine("== Conversor romaji/kana ==");
        var r2k = new (string In, string Out)[]
        {
            ("konnichiwa", "こんにちわ"), ("gakkou", "がっこう"), ("matcha", "まっちゃ"), ("kon'ya", "こんや"),
            ("shinbun", "しんぶん"), ("ko-hi-", "こーひー"), ("arigatou", "ありがとう"), ("kitte", "きって"),
            ("ryokou", "りょこう"), ("tsukue", "つくえ"), ("jisho", "じしょ"), ("onna", "おんな"), ("sennsei", "せんせい"),
            ("kyuu", "きゅう"), ("benkyou", "べんきょう"), ("fakkusu", "ふぁっくす"), ("wo", "を"), ("nn", "ん"),
        };
        foreach (var (i, o) in r2k)
        {
            var got = Kana.RomajiToHiragana(i);
            if (got != o) Fail($"RomajiToHiragana(\"{i}\") = {got}, esperado {o}");
        }
        var k2r = new (string In, string Out)[]
        {
            ("わたし は がくせい です。", "watashi wa gakusei desu."), ("きって", "kitte"), ("コーヒー", "koohii"),
            ("しんぶん", "shinbun"), ("こんや", "kon'ya"), ("まっちゃ", "matcha"), ("にほん へ いきます", "nihon e ikimasu"),
            ("パン を ください", "pan o kudasai"), ("ファイル", "fairu"), ("じゃあね", "jaane"),
        };
        foreach (var (i, o) in k2r)
        {
            var got = Kana.ToRomaji(i);
            if (got != o) Fail($"ToRomaji(\"{i}\") = \"{got}\", esperado \"{o}\"");
        }
        if (Kana.Compare("konnichiwa", "こんにちは") != Kana.MatchResult.ParticleLenient) Fail("Compare konnichiwa ~ こんにちは deveria ser ParticleLenient");
        if (Kana.Compare("ke-ki", "ケーキ") != Kana.MatchResult.Exact) Fail("Compare ke-ki ~ ケーキ deveria ser Exact");
        if (Kana.Compare("tabeta", "たべない") != Kana.MatchResult.Wrong) Fail("Compare tabeta ~ たべない deveria ser Wrong");

        // ---------- conteúdo ----------
        sb.AppendLine("== Conteúdo ==");
        ContentRepository.Load();
        foreach (var e in ContentRepository.Errors) Fail("Erro de carga: " + e);
        int lessons = 0, vocab = 0, generated = 0;
        var ids = new HashSet<string>();
        foreach (var l in ContentRepository.AllLessons)
        {
            lessons++;
            if (!ids.Add(l.Id)) Fail($"ID de lição duplicado: {l.Id}");
            if (l.Theory.Count == 0) Fail($"{l.Id}: sem teoria");
            foreach (var v in l.Vocab)
            {
                vocab++;
                if (v.Length < 3) { Fail($"{l.Id}: vocab com menos de 3 campos: {string.Join("|", v)}"); continue; }
                var item = new VocabItem(v[0], v[1], v[2], l.Id);
                if (Kana.ContainsKanji(item.Reading)) Fail($"{l.Id}: leitura com kanji: {v[0]} / {v[1]}");
                var rom = item.Romaji;
                if (rom.Any(c => Kana.IsKana(c))) Fail($"{l.Id}: romaji incompleto para {item.Reading}: {rom}");
            }
            foreach (var ex in l.Examples)
            {
                if (ex.Length < 3) { Fail($"{l.Id}: exemplo incompleto"); continue; }
                if (Kana.ContainsKanji(ex[1])) Fail($"{l.Id}: leitura de exemplo com kanji: {ex[1]}");
            }
            foreach (var d in l.Dialog)
            {
                if (d.Length < 4) { Fail($"{l.Id}: linha de diálogo incompleta"); continue; }
                if (Kana.ContainsKanji(d[2])) Fail($"{l.Id}: leitura de diálogo com kanji: {d[2]}");
            }
            foreach (var def in l.Exercises)
            {
                var ex = ExerciseFactory.FromDef(def);
                if (ex == null) { Fail($"{l.Id}: exercício inválido ({def.T}: {def.Q})"); continue; }
                if (ex.Type is ExType.Choice or ExType.Listen)
                {
                    if (ex.Answer < 0 || ex.Answer >= ex.Options.Count) Fail($"{l.Id}: índice de resposta inválido ({def.Q})");
                    if (ex.Options.Distinct().Count() != ex.Options.Count) Fail($"{l.Id}: opções repetidas ({def.Q})");
                }
                if (ex.Type == ExType.Typing)
                {
                    if (!ex.Accepted.Any(a => Kana.IsAllKana(Kana.NormalizeAnswer(a))))
                        Fail($"{l.Id}: digitação sem resposta só em kana ({def.Q})");
                    foreach (var a in ex.Accepted.Where(a => Kana.IsAllKana(Kana.NormalizeAnswer(a))))
                    {
                        var viaRomaji = Kana.ToRomaji(Kana.NormalizeAnswer(a));
                        if (Kana.Compare(viaRomaji, a) == Kana.MatchResult.Wrong)
                            Fail($"{l.Id}: resposta '{a}' não é alcançável digitando '{viaRomaji}'");
                    }
                }
                if (ex.Type == ExType.Order && ex.Correct.Count < 2) Fail($"{l.Id}: ordem com poucas peças");
            }
            try
            {
                var gen = ExerciseFactory.ForLesson(l);
                generated += gen.Count;
                if (gen.Count < 5) Fail($"{l.Id}: só {gen.Count} exercícios gerados");
                foreach (var g in gen.Where(g => g.Type is ExType.Choice or ExType.Listen))
                    if (g.Options.Count < 2 || g.Answer < 0) Fail($"{l.Id}: exercício gerado sem opções ({g.Prompt})");
            }
            catch (Exception exn)
            {
                Fail($"{l.Id}: erro ao gerar exercícios: {exn.Message}");
            }
        }
        sb.AppendLine($"  Lições: {lessons} · vocabulário: {vocab} · exercícios gerados (1 rodada): {generated}");

        // kanji
        sb.AppendLine($"  Kanji: {ContentRepository.Kanji.Count} ({string.Join(", ", ContentRepository.Kanji.GroupBy(k => k.Level).Select(g => g.Key + "=" + g.Count()))})");
        var dupK = ContentRepository.Kanji.GroupBy(k => k.Char).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        if (dupK.Count > 0) Fail("Kanji duplicados: " + string.Join(" ", dupK));
        foreach (var k in ContentRepository.Kanji)
        {
            if (string.IsNullOrWhiteSpace(k.Meaning)) Fail($"Kanji {k.Char} sem significado");
            if (k.Words.Count == 0) Fail($"Kanji {k.Char} sem palavras de exemplo");
            foreach (var w in k.Words)
            {
                if (!w.Jp.Contains(k.Char)) Fail($"Kanji {k.Char}: palavra {w.Jp} não contém o kanji");
                if (Kana.ContainsKanji(w.Reading)) Fail($"Kanji {k.Char}: leitura com kanji em {w.Jp}");
            }
        }
        foreach (var lvl in ContentRepository.Kanji.Select(k => k.Level).Distinct())
        {
            try { ExerciseFactory.KanjiDrill(ContentRepository.Kanji.Where(k => k.Level == lvl).Take(10).ToList()); }
            catch (Exception exn) { Fail($"KanjiDrill {lvl}: {exn.Message}"); }
        }

        // frases
        int phrases = ContentRepository.Phrases.Sum(p => p.Phrases.Count);
        sb.AppendLine($"  Frases: {phrases} em {ContentRepository.Phrases.Count} categorias · dicas: {ContentRepository.Tips.Count}");
        foreach (var c in ContentRepository.Phrases)
            foreach (var p in c.Phrases)
            {
                if (p.Length < 3) Fail($"Frase incompleta em {c.Name}");
                else if (Kana.ContainsKanji(p[1])) Fail($"Frase com kanji na leitura: {p[1]}");
            }
        try { foreach (var c in ContentRepository.Phrases) ExerciseFactory.PhraseDrill(c.Items.ToList(), 10); }
        catch (Exception exn) { Fail("PhraseDrill: " + exn.Message); }

        // kana drill
        try
        {
            var allKana = Kana.GojuonRows.Concat(Kana.DakutenRows).SelectMany(r => r.Kana).Where(k => k != "").ToList();
            ExerciseFactory.KanaDrill(allKana, 30);
            ExerciseFactory.KanaDrill(allKana.Select(Kana.ToKatakana).ToList(), 30);
        }
        catch (Exception exn) { Fail("KanaDrill: " + exn.Message); }

        sb.Insert(0, problems == 0 ? "RESULTADO: OK (0 problemas)\n" : $"RESULTADO: {problems} problema(s)\n");
        File.WriteAllText(outputPath, sb.ToString(), Encoding.UTF8);
        return problems;
    }
}
