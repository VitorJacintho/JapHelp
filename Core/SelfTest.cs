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

        // ---------- áudio ----------
        sb.AppendLine("== Áudio ==");
        try
        {
            Speech.Init();
            sb.AppendLine($"  Vozes: {Speech.AllVoices.Count} ({string.Join(", ", Speech.AllVoices.Select(v => v.Name + "/" + v.Language + "/" + v.Engine))})");
            sb.AppendLine($"  Japonesas: {Speech.JapaneseVoices.Count} · em uso: {(Speech.Available ? Speech.VoiceName : "nenhuma")}");
            // testa o pipeline de síntese com qualquer voz moderna disponível
            var any = Speech.JapaneseVoices.FirstOrDefault(v => v.Engine == "moderna") ?? Speech.AllVoices.FirstOrDefault(v => v.Engine == "moderna");
            if (any != null)
            {
                var before = Speech.CurrentVoiceId;
                Speech.SelectVoice(any.Id);
                var phrase = any.IsJapanese ? "こんにちは。テストです。" : "Hello, this is a speech test.";
                var wav = Speech.SynthesizeAsync(phrase, 1.0).GetAwaiter().GetResult();
                if (wav == null || wav.Length < 2000 || System.Text.Encoding.ASCII.GetString(wav, 0, 4) != "RIFF")
                    Fail($"Síntese com {any.Name} não gerou WAV válido");
                else
                {
                    using var ms = new MemoryStream(wav);
                    new System.Media.SoundPlayer(ms).Load();
                    sb.AppendLine($"  Síntese OK com {any.Name}: {wav.Length} bytes de WAV");
                }
                var slow = Speech.SynthesizeAsync(phrase, 0.6).GetAwaiter().GetResult();
                if (slow != null && wav != null && slow.Length <= wav.Length) Fail("Velocidade lenta não gerou áudio mais longo");
                if (before != null) Speech.SelectVoice(before);
            }
            sb.AppendLine($"  Reconhecimento: {string.Join(", ", SpeechPractice.RecognizerLanguages())} · japonês: {SpeechPractice.JapaneseRecognitionAvailable}");
            sb.AppendLine($"  Microfone: {SpeechPractice.HasMicrophone}");
            if (SpeechPractice.HasMicrophone)
            {
                ProgressStore.OverrideFolder ??= Path.Combine(Path.GetTempPath(), "japhelp_selftest");
                var err = SpeechPractice.StartRecording();
                Thread.Sleep(600);
                err += SpeechPractice.StopRecording();
                if (err != "") sb.AppendLine("  (aviso) gravação: " + err);
                else sb.AppendLine($"  Gravação OK: {new FileInfo(SpeechPractice.RecordingPath).Length} bytes");
            }
            var sim = SpeechPractice.Similarity("すみません", "すみません。");
            if (sim < 0.99) Fail($"Similarity idêntico deveria ser 1, deu {sim}");
            if (SpeechPractice.Similarity("すみません", "ありがとう") > 0.3) Fail("Similarity de frases diferentes muito alta");
        }
        catch (Exception exn)
        {
            Fail("Áudio: " + exn.Message);
        }

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
            foreach (var t in l.Text)
            {
                if (t.Length < 3) { Fail($"{l.Id}: parágrafo de texto incompleto"); continue; }
                if (Kana.ContainsKanji(t[1])) Fail($"{l.Id}: leitura de texto com kanji: {t[1]}");
                if (Kana.ToRomaji(t[1]).Any(Kana.IsKana)) Fail($"{l.Id}: romaji incompleto no texto: {t[1]}");
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

        // decks
        sb.AppendLine($"  Decks: {ContentRepository.Decks.Count} com {ContentRepository.Decks.Sum(d => d.Items.Count)} palavras ({string.Join(", ", ContentRepository.Decks.GroupBy(d => d.Level).Select(g => g.Key + "=" + g.Sum(d => d.Items.Count)))})");
        foreach (var d in ContentRepository.Decks)
        {
            if (d.Items.Count < 4) Fail($"Deck {d.Name}: poucas palavras");
            foreach (var dup in d.Items.GroupBy(v => v.Jp + "|" + v.Reading).Where(g => g.Count() > 1))
                Fail($"Deck {d.Name}: palavra repetida {dup.Key}");
            foreach (var v in d.Items)
            {
                if (Kana.ContainsKanji(v.Reading)) Fail($"Deck {d.Name}: leitura com kanji em {v.Jp}");
                if (v.Romaji.Any(Kana.IsKana)) Fail($"Deck {d.Name}: romaji incompleto em {v.Jp}");
                if (!Kana.ContainsJapanese(v.Jp)) Fail($"Deck {d.Name}: palavra sem japonês: {v.Jp}");
            }
            try { ExerciseFactory.VocabDrill(d.Items, Math.Min(20, d.Items.Count), d.Items); }
            catch (Exception exn) { Fail($"Deck {d.Name}: {exn.Message}"); }
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

        // ordem dos traços (KanjiVG) e furigana
        var semTracos = ContentRepository.Kanji.Where(k => Strokes.Get(k.Char) == null).Select(k => k.Char).ToList();
        if (semTracos.Count > 0) Fail("Kanji sem ordem dos traços (rode mobile/ferramentas/kanjivg.ps1): " + string.Join(" ", semTracos.Take(30)));
        foreach (var ch in ContentRepository.Kanji.Select(k => k.Char).Where(c => Strokes.Get(c) != null))
        {
            var paths = Strokes.Get(ch)!;
            var exact = paths.Select(d => (IReadOnlyList<PointF>)Strokes.PathPoints(d)).ToList();
            if (!Strokes.Check(paths, exact).Ok) Fail($"Traços de {ch}: o desenho exato não passou na conferência");
        }
        var furiPairs = ContentRepository.AllLessons.SelectMany(l => l.VocabItems
                .Concat(l.Examples.Where(e => e.Length >= 3).Select(e => new VocabItem(e[0], e[1], e[2], l.Id))))
            .Concat(ContentRepository.Decks.SelectMany(d => d.Items))
            .Where(v => Kana.ContainsKanji(v.Jp) && v.Reading != v.Jp).ToList();
        var furiFail = furiPairs.Where(v => Furigana.Align(v.Jp, v.Reading) == null).Select(v => v.Jp).Distinct().ToList();
        sb.AppendLine($"  Furigana: {furiPairs.Count - furiFail.Count} de {furiPairs.Count} encaixam · traços: {Strokes.AllChars.Count} caracteres");
        foreach (var f in furiFail.Take(10)) Fail("Furigana não encaixa (confira a leitura): " + f);

        sb.Insert(0, problems == 0 ? "RESULTADO: OK (0 problemas)\n" : $"RESULTADO: {problems} problema(s)\n");
        File.WriteAllText(outputPath, sb.ToString(), Encoding.UTF8);
        return problems;
    }
}
