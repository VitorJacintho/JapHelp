using System.Text.Json;

namespace JapHelp.Core;

/// <summary>Carrega todo o conteúdo do curso da pasta Content (ao lado do .exe).</summary>
public static class ContentRepository
{
    public static List<CourseModule> Modules { get; private set; } = new();
    public static List<KanjiEntry> Kanji { get; private set; } = new();
    public static List<PhraseCategory> Phrases { get; private set; } = new();
    public static List<string> Tips { get; private set; } = new();
    public static List<string> Errors { get; } = new();

    public static string ContentDir => Path.Combine(AppContext.BaseDirectory, "Content");

    private static readonly JsonSerializerOptions Opts = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static void Load()
    {
        Errors.Clear();
        Modules = new();
        if (!Directory.Exists(ContentDir))
        {
            Errors.Add("Pasta Content não encontrada em " + ContentDir);
            return;
        }

        foreach (var file in Directory.GetFiles(ContentDir, "curso_*.json").OrderBy(f => f))
        {
            try
            {
                var mod = JsonSerializer.Deserialize<CourseModule>(File.ReadAllText(file), Opts);
                if (mod == null) continue;
                for (int i = 0; i < mod.Lessons.Count; i++)
                {
                    mod.Lessons[i].Module = mod;
                    mod.Lessons[i].Index = i;
                }
                Modules.Add(mod);
            }
            catch (Exception ex)
            {
                Errors.Add($"{Path.GetFileName(file)}: {ex.Message}");
            }
        }
        Modules = Modules.OrderBy(m => m.Order).ToList();

        LoadKanji();
        LoadDecks();
        LoadPhrases();
        LoadTips();
    }

    private static void LoadKanji()
    {
        Kanji = new();
        var files = Directory.GetFiles(ContentDir, "kanji*.txt").OrderBy(f => Path.GetFileName(f) == "kanji.txt" ? "" : f).ToList();
        var counters = new Dictionary<string, int>();
        foreach (var file in files)
            LoadKanjiFile(file, counters);
    }

    private static void LoadKanjiFile(string file, Dictionary<string, int> counters)
    {
        string level = "N5";
        int lineNo = 0;
        foreach (var raw in File.ReadAllLines(file))
        {
            lineNo++;
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("//")) continue;
            if (line.StartsWith("#"))
            {
                level = line.TrimStart('#').Trim();
                continue;
            }
            try
            {
                // 日|ニチ・ジツ|ひ・か|dia; sol|日本:にほん:Japão;毎日:まいにち:todos os dias
                var p = line.Split('|');
                var k = new KanjiEntry
                {
                    Char = p[0].Trim(),
                    Level = level,
                    On = p.Length > 1 ? p[1].Trim() : "",
                    Kun = p.Length > 2 ? p[2].Trim() : "",
                    Meaning = p.Length > 3 ? p[3].Trim() : "",
                };
                if (p.Length > 4)
                {
                    foreach (var w in p[4].Split(';', StringSplitOptions.RemoveEmptyEntries))
                    {
                        var wp = w.Split(':');
                        if (wp.Length >= 3) k.Words.Add(new VocabItem(wp[0].Trim(), wp[1].Trim(), wp[2].Trim(), "kanji:" + k.Char));
                    }
                }
                counters.TryGetValue(level, out var n);
                k.Group = n / 10;
                counters[level] = n + 1;
                Kanji.Add(k);
            }
            catch (Exception ex)
            {
                Errors.Add($"{Path.GetFileName(file)} linha {lineNo}: {ex.Message}");
            }
        }
    }

    public static List<VocabDeck> Decks { get; private set; } = new();

    /// <summary>
    /// Decks em Content/vocab_*.txt:
    /// "# Nome | ícone | nível" inicia um deck; depois "japonês|leitura|significado" por linha.
    /// </summary>
    private static void LoadDecks()
    {
        Decks = new();
        foreach (var file in Directory.GetFiles(ContentDir, "vocab_*.txt").OrderBy(f => f))
        {
            VocabDeck? deck = null;
            int lineNo = 0;
            foreach (var raw in File.ReadAllLines(file))
            {
                lineNo++;
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("//")) continue;
                if (line.StartsWith("#"))
                {
                    var h = line.TrimStart('#').Split('|').Select(s => s.Trim()).ToArray();
                    deck = new VocabDeck
                    {
                        Name = h[0],
                        Icon = h.Length > 1 && h[1].Length > 0 ? h[1] : "語",
                        Level = h.Length > 2 ? h[2] : "",
                    };
                    Decks.Add(deck);
                    continue;
                }
                var p = line.Split('|');
                if (deck == null || p.Length < 3)
                {
                    Errors.Add($"{Path.GetFileName(file)} linha {lineNo}: formato inválido");
                    continue;
                }
                deck.Items.Add(new VocabItem(p[0].Trim(), p[1].Trim(), p[2].Trim(), "deck:" + deck.Name));
            }
        }
        Decks = Decks.OrderBy(d => d.Level switch { "N5" => 0, "N4" => 1, "N3" => 2, "N2" => 3, _ => 9 }).ToList();
    }

    private static void LoadPhrases()
    {
        Phrases = new();
        var file = Path.Combine(ContentDir, "frases.json");
        if (!File.Exists(file)) return;
        try
        {
            Phrases = JsonSerializer.Deserialize<List<PhraseCategory>>(File.ReadAllText(file), Opts) ?? new();
        }
        catch (Exception ex)
        {
            Errors.Add("frases.json: " + ex.Message);
        }
    }

    private static void LoadTips()
    {
        var file = Path.Combine(ContentDir, "dicas.txt");
        Tips = File.Exists(file)
            ? File.ReadAllLines(file).Where(l => !string.IsNullOrWhiteSpace(l) && !l.StartsWith("//")).ToList()
            : new List<string> { "Estude um pouco todos os dias: 15 minutos diários valem mais que 3 horas no domingo." };
    }

    public static IEnumerable<Lesson> AllLessons => Modules.SelectMany(m => m.Lessons);

    public static IEnumerable<VocabItem> AllVocab => AllLessons.SelectMany(l => l.VocabItems);

    public static Lesson? FindLesson(string id) => AllLessons.FirstOrDefault(l => l.Id == id);

    public static Lesson? NextRecommended() =>
        AllLessons.FirstOrDefault(l => !ProgressStore.IsCompleted(l.Id));

    public static Lesson? NextLesson(Lesson l)
    {
        var all = AllLessons.ToList();
        var idx = all.IndexOf(l);
        return idx >= 0 && idx + 1 < all.Count ? all[idx + 1] : null;
    }
}
