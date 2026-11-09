namespace JapHelp.Core;

/// <summary>Monta listas de exercícios a partir do conteúdo (escritos à mão + gerados automaticamente).</summary>
public static class ExerciseFactory
{
    private static readonly Random Rng = new();

    public static List<T> Shuffle<T>(IEnumerable<T> items)
    {
        var list = items.ToList();
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = Rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }

    // ================= LIÇÃO =================
    public static List<Exercise> ForLesson(Lesson lesson)
    {
        var result = new List<Exercise>();

        if (!string.IsNullOrWhiteSpace(lesson.Kana))
            result.AddRange(KanaDrill(Kana.SplitUnits(lesson.Kana!), 12));

        var vocab = lesson.VocabItems.ToList();
        if (vocab.Count > 0)
        {
            int n = lesson.Exercises.Count >= 10 ? 6 : 9;
            result.AddRange(VocabDrill(vocab, Math.Min(n, vocab.Count), ContentRepository.AllVocab.ToList()));
        }

        var authored = lesson.Exercises.Select(FromDef).Where(e => e != null).Cast<Exercise>().ToList();
        result.AddRange(authored);
        return result;
    }

    public static Exercise? FromDef(ExerciseDef d)
    {
        switch (d.T.ToLowerInvariant())
        {
            case "mc":
            case "listen":
            {
                if (d.O == null || d.O.Count < 2) return null;
                var ex = new Exercise
                {
                    Type = d.T == "listen" ? ExType.Listen : ExType.Choice,
                    Context = d.Ctx,
                    Prompt = d.Q ?? (d.T == "listen" ? "O que você ouviu?" : "Escolha a resposta correta"),
                    Japanese = d.Jp,
                    SpeakText = d.S ?? d.Jp,
                    Explanation = d.E,
                    Hint = d.Hint,
                };
                ShuffleOptions(ex, d.O, Math.Clamp(d.A, 0, d.O.Count - 1));
                ex.OptionsJapanese = ex.Options.Any(Kana.ContainsJapanese);
                return ex;
            }
            case "type":
            {
                if (d.Acc == null || d.Acc.Count == 0) return null;
                return new Exercise
                {
                    Type = ExType.Typing,
                    Context = d.Ctx,
                    Prompt = d.Q ?? "Escreva em japonês",
                    Japanese = d.Jp,
                    SpeakText = d.S ?? d.Jp,
                    Accepted = d.Acc,
                    Explanation = d.E,
                    Hint = d.Hint,
                };
            }
            case "order":
            {
                if (d.W == null || d.W.Count < 2) return null;
                var tiles = new List<string>(d.W);
                if (d.X != null) tiles.AddRange(d.X);
                return new Exercise
                {
                    Type = ExType.Order,
                    Context = d.Ctx,
                    Prompt = d.Q ?? "Monte a frase",
                    Japanese = d.Jp,
                    Correct = d.W,
                    Tiles = Shuffle(tiles),
                    SpeakText = string.Join("", d.W),
                    Explanation = d.E,
                    Hint = d.Hint,
                };
            }
        }
        return null;
    }

    private static void ShuffleOptions(Exercise ex, List<string> options, int correctIndex)
    {
        var correct = options[correctIndex];
        var shuffled = Shuffle(options);
        ex.Options = shuffled;
        ex.Answer = shuffled.IndexOf(correct);
    }

    // ================= KANA =================
    public static List<Exercise> KanaDrill(List<string> units, int count, bool katakanaHint = false)
    {
        var result = new List<Exercise>();
        if (units.Count == 0) return result;
        var pool = Shuffle(units);
        while (pool.Count < count) pool.AddRange(Shuffle(units));
        pool = pool.Take(count).ToList();

        // distratores: do próprio conjunto + kana parecidos
        foreach (var (u, i) in pool.Select((u, i) => (u, i)))
        {
            var romaji = Kana.ToRomaji(u);
            int mode = i % 3;
            if (mode == 2 && !Speech.Available) mode = 1;
            switch (mode)
            {
                case 0:
                    result.Add(new Exercise
                    {
                        Type = ExType.Typing,
                        Prompt = "Como se lê este kana? Digite em romaji.",
                        Japanese = u,
                        BigJapanese = true,
                        AudioRevealsAnswer = true,
                        SpeakText = u,
                        Accepted = new() { u },
                        StatKey = "kana:" + u,
                        Explanation = $"{u} = {romaji}",
                    });
                    break;
                case 1:
                {
                    var ex = new Exercise
                    {
                        Type = ExType.Choice,
                        Prompt = $"Qual kana é \"{romaji}\"?",
                        SpeakText = u,
                        StatKey = "kana:" + u,
                        OptionsJapanese = true,
                        Explanation = $"{romaji} = {u}",
                    };
                    var opts = KanaDistractors(u, units, 3);
                    opts.Insert(0, u);
                    ShuffleOptions(ex, opts, 0);
                    result.Add(ex);
                    break;
                }
                default:
                {
                    var ex = new Exercise
                    {
                        Type = ExType.Listen,
                        Prompt = "Ouça e escolha o kana correto",
                        SpeakText = u,
                        StatKey = "kana:" + u,
                        OptionsJapanese = true,
                        Explanation = $"Você ouviu \"{romaji}\" = {u}",
                    };
                    var opts = KanaDistractors(u, units, 3);
                    opts.Insert(0, u);
                    ShuffleOptions(ex, opts, 0);
                    result.Add(ex);
                    break;
                }
            }
        }
        return result;
    }

    private static readonly string[][] SimilarKana =
    {
        new[] { "あ", "お", "め", "ぬ" }, new[] { "い", "り", "こ" }, new[] { "う", "ら", "つ" }, new[] { "さ", "ち", "き" },
        new[] { "は", "ほ", "け" }, new[] { "ね", "れ", "わ" }, new[] { "る", "ろ" }, new[] { "ぬ", "め" }, new[] { "し", "つ", "も" },
        new[] { "シ", "ツ" }, new[] { "ソ", "ン", "リ" }, new[] { "ク", "ワ", "ウ", "タ" }, new[] { "コ", "ユ" }, new[] { "チ", "テ" },
        new[] { "ヌ", "ス", "フ" }, new[] { "マ", "ム", "ア" }, new[] { "ノ", "メ" }, new[] { "ハ", "ル" }, new[] { "セ", "サ", "ヤ" },
    };

    private static List<string> KanaDistractors(string target, List<string> pool, int n)
    {
        var cands = new List<string>();
        foreach (var group in SimilarKana)
            if (group.Contains(target)) cands.AddRange(group.Where(g => g != target));
        cands.AddRange(Shuffle(pool.Where(p => p != target)));
        if (cands.Count < n)
        {
            bool kata = target.Any(Kana.IsKatakana);
            var all = Kana.GojuonRows.SelectMany(r => r.Kana).Where(k => k != "").ToList();
            cands.AddRange(Shuffle(all.Select(k => kata ? Kana.ToKatakana(k) : k).Where(k => k != target)));
        }
        return cands.Distinct().Where(c => c != target).Take(n).ToList();
    }

    // ================= VOCABULÁRIO =================
    public static List<Exercise> VocabDrill(List<VocabItem> items, int count, List<VocabItem> distractorPool)
    {
        var result = new List<Exercise>();
        var chosen = Shuffle(items).Take(count).ToList();
        int i = 0;
        foreach (var v in chosen)
        {
            int mode = i++ % 4;
            if (mode == 2 && !Speech.Available) mode = 0;
            bool canType = v.Reading.Length <= 10 && Kana.IsAllKana(v.Reading);
            if (mode == 3 && !canType) mode = 1;
            result.Add(VocabExercise(v, mode, items, distractorPool));
        }
        return result;
    }

    /// <summary>mode: 0 = JP→PT, 1 = PT→JP, 2 = ouvir→PT, 3 = digitar leitura</summary>
    public static Exercise VocabExercise(VocabItem v, int mode, List<VocabItem> sameSet, List<VocabItem> pool)
    {
        var others = Shuffle(sameSet.Where(x => x.Meaning != v.Meaning && x.Jp != v.Jp))
            .Concat(Shuffle(pool.Where(x => x.Meaning != v.Meaning && x.Jp != v.Jp)).Take(12))
            .DistinctBy(x => x.Meaning).Take(3).ToList();

        switch (mode)
        {
            case 0:
            {
                var ex = new Exercise
                {
                    Type = ExType.Choice,
                    Prompt = "O que significa?",
                    Japanese = v.Jp,
                    JapaneseReading = v.HasKanji ? v.Reading : null,
                    SpeakText = v.Jp,
                    StatKey = v.Key,
                    Explanation = $"{v.Jp}（{v.Reading}）= {v.Meaning}",
                };
                var opts = others.Select(o => o.Meaning).Prepend(v.Meaning).ToList();
                ShuffleOptions(ex, opts, 0);
                return ex;
            }
            case 1:
            {
                var ex = new Exercise
                {
                    Type = ExType.Choice,
                    Prompt = $"Como se diz \"{v.Meaning}\"?",
                    SpeakText = v.Jp,
                    StatKey = v.Key,
                    OptionsJapanese = true,
                    Explanation = $"{v.Meaning} = {v.Jp}（{v.Reading}）",
                };
                var opts = others.Select(o => o.Jp).Prepend(v.Jp).Distinct().ToList();
                ShuffleOptions(ex, opts, 0);
                return ex;
            }
            case 2:
            {
                var ex = new Exercise
                {
                    Type = ExType.Listen,
                    Prompt = "Ouça e escolha o significado",
                    SpeakText = v.Jp,
                    StatKey = v.Key,
                    Explanation = $"Você ouviu: {v.Jp}（{v.Reading}）= {v.Meaning}",
                };
                var opts = others.Select(o => o.Meaning).Prepend(v.Meaning).ToList();
                ShuffleOptions(ex, opts, 0);
                return ex;
            }
            default:
                return new Exercise
                {
                    Type = ExType.Typing,
                    Prompt = $"Escreva em japonês (romaji vira kana): \"{v.Meaning}\"",
                    SpeakText = v.Jp,
                    AudioRevealsAnswer = true,
                    StatKey = v.Key,
                    Accepted = new() { v.Reading, v.Jp },
                    Hint = $"Começa com {v.Reading[0]}… ({v.Reading.Length} kana)",
                    Explanation = $"{v.Meaning} = {v.Jp}（{v.Reading}）",
                };
        }
    }

    // ================= KANJI =================
    public static List<Exercise> KanjiDrill(List<KanjiEntry> set)
    {
        var result = new List<Exercise>();
        var allKanji = ContentRepository.Kanji;
        foreach (var k in Shuffle(set))
        {
            // kanji -> significado
            var ex1 = new Exercise
            {
                Type = ExType.Choice,
                Prompt = "Qual o significado deste kanji?",
                Japanese = k.Char,
                BigJapanese = true,
                StatKey = "k:" + k.Char,
                Explanation = $"{k.Char}: {k.Meaning}  ·  on: {k.On}  ·  kun: {k.Kun}",
            };
            var wrong = Shuffle(set.Concat(allKanji).Where(o => o.Char != k.Char && o.Meaning != k.Meaning)).DistinctBy(o => o.Meaning).Take(3).Select(o => o.Meaning);
            ShuffleOptions(ex1, wrong.Prepend(k.Meaning).ToList(), 0);
            result.Add(ex1);

            // palavra -> leitura
            var w = k.Words.FirstOrDefault();
            if (w != null)
            {
                var readings = Shuffle(set.Concat(allKanji).SelectMany(o => o.Words).Where(o => o.Reading != w.Reading)).DistinctBy(o => o.Reading).Take(3).Select(o => o.Reading);
                var ex2 = new Exercise
                {
                    Type = ExType.Choice,
                    Prompt = $"Como se lê esta palavra? ({w.Meaning})",
                    Japanese = w.Jp,
                    SpeakText = w.Jp,
                    AudioRevealsAnswer = true,
                    StatKey = "k:" + k.Char,
                    OptionsJapanese = true,
                    Explanation = $"{w.Jp} = {w.Reading} ({Kana.ToRomaji(w.Reading)}) — {w.Meaning}",
                };
                ShuffleOptions(ex2, readings.Prepend(w.Reading).ToList(), 0);
                result.Add(ex2);
            }
        }
        // significado -> kanji (alguns)
        foreach (var k in Shuffle(set).Take(Math.Min(5, set.Count)))
        {
            var ex3 = new Exercise
            {
                Type = ExType.Choice,
                Prompt = $"Qual kanji significa \"{k.Meaning}\"?",
                StatKey = "k:" + k.Char,
                OptionsJapanese = true,
                Explanation = $"{k.Meaning} = {k.Char}",
            };
            var wrong = Shuffle(set.Concat(allKanji).Where(o => o.Char != k.Char)).DistinctBy(o => o.Char).Take(3).Select(o => o.Char);
            ShuffleOptions(ex3, wrong.Prepend(k.Char).ToList(), 0);
            result.Add(ex3);
        }
        return result;
    }

    // ================= FRASES =================
    public static List<Exercise> PhraseDrill(List<VocabItem> phrases, int count)
    {
        var result = new List<Exercise>();
        var pool = ContentRepository.Phrases.SelectMany(c => c.Items).ToList();
        int i = 0;
        foreach (var p in Shuffle(phrases).Take(count))
        {
            int mode = i++ % 3;
            if (mode == 2 && !Speech.Available) mode = 0;
            result.Add(VocabExercise(p, mode switch { 0 => 1, 1 => 0, _ => 2 }, phrases, pool));
        }
        return result;
    }
}
