using System.Text.Json;

namespace JapHelp.Core;

public class AppSettings
{
    public bool ShowRomaji { get; set; } = true;
    public bool ShowReading { get; set; } = true;
    public int SpeechRate { get; set; } = -1;
    public double SpeechSpeed { get; set; } = 0.9;
    public string? VoiceId { get; set; }
    public int DailyGoalXp { get; set; } = 60;
    public bool AutoPlayAudio { get; set; } = true;
    public int MaxReviewsPerSession { get; set; } = 40;
}

public class LessonProgress
{
    public bool Completed { get; set; }
    public int BestScore { get; set; }
    public int Attempts { get; set; }
    public bool TheoryRead { get; set; }
    public DateTime LastDate { get; set; }
}

public class SrsItem
{
    public string Key { get; set; } = "";
    public string Kind { get; set; } = "vocab"; // vocab | kanji | frase
    public string Front { get; set; } = "";
    public string Reading { get; set; } = "";
    public string Back { get; set; } = "";
    public string Extra { get; set; } = "";
    public int Box { get; set; }
    public DateTime Due { get; set; } = DateTime.Today;
    public int Reviews { get; set; }
    public int Lapses { get; set; }
}

public class ProgressData
{
    public Dictionary<string, LessonProgress> Lessons { get; set; } = new();
    public Dictionary<string, SrsItem> Srs { get; set; } = new();
    public Dictionary<string, int> DailyXp { get; set; } = new();
    /// <summary>Erros por item (kana, kanji, vocabulário) — usados para "pontos fracos".</summary>
    public Dictionary<string, int> Mistakes { get; set; } = new();
    public HashSet<string> KanjiGroupsDone { get; set; } = new();
    /// <summary>Melhor nota (0-100) de pronúncia por frase.</summary>
    public Dictionary<string, int> SpeakingBest { get; set; } = new();
    public HashSet<string> VocabDecksDone { get; set; } = new();
    public int Xp { get; set; }
    public int Streak { get; set; }
    public int BestStreak { get; set; }
    public DateTime LastStudyDate { get; set; }
    public AppSettings Settings { get; set; } = new();
}

/// <summary>Salva e carrega o progresso em %APPDATA%\JapHelp\progress.json.</summary>
public static class ProgressStore
{
    // Leitner: intervalo (dias) por caixa
    public static readonly int[] Intervals = { 0, 1, 2, 4, 7, 14, 30, 60, 120, 240 };

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public static ProgressData Data { get; private set; } = new();

    /// <summary>Usado só em modo de teste, para não mexer no progresso real.</summary>
    public static string? OverrideFolder { get; set; }

    public static string FolderPath => OverrideFolder ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "JapHelp");
    public static string FilePath => Path.Combine(FolderPath, "progress.json");

    public static event Action? Changed;

    public static void Load()
    {
        try
        {
            if (File.Exists(FilePath))
                Data = JsonSerializer.Deserialize<ProgressData>(File.ReadAllText(FilePath), JsonOpts) ?? new ProgressData();
        }
        catch
        {
            // arquivo corrompido: guarda cópia e recomeça
            try { File.Copy(FilePath, FilePath + ".bak", true); } catch { }
            Data = new ProgressData();
        }
        Speech.Speed = Math.Clamp(Data.Settings.SpeechSpeed, 0.5, 1.5);
        CheckStreakBroken();
    }

    public static void Save()
    {
        try
        {
            Directory.CreateDirectory(FolderPath);
            var tmp = FilePath + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(Data, JsonOpts));
            File.Move(tmp, FilePath, true);
        }
        catch { }
        Changed?.Invoke();
    }

    public static void Reset()
    {
        var settings = Data.Settings;
        Data = new ProgressData { Settings = settings };
        Save();
    }

    private static void CheckStreakBroken()
    {
        if (Data.LastStudyDate == default) return;
        if ((DateTime.Today - Data.LastStudyDate.Date).TotalDays > 1) Data.Streak = 0;
    }

    public static int TodayXp => Data.DailyXp.TryGetValue(DateTime.Today.ToString("yyyy-MM-dd"), out var x) ? x : 0;

    public static void AddXp(int amount)
    {
        if (amount <= 0) return;
        Data.Xp += amount;
        var key = DateTime.Today.ToString("yyyy-MM-dd");
        Data.DailyXp[key] = TodayXp + amount;
        var last = Data.LastStudyDate.Date;
        if (last != DateTime.Today)
        {
            Data.Streak = (DateTime.Today - last).TotalDays == 1 ? Data.Streak + 1 : 1;
            Data.BestStreak = Math.Max(Data.BestStreak, Data.Streak);
            Data.LastStudyDate = DateTime.Today;
        }
    }

    public static LessonProgress GetLesson(string id)
    {
        if (!Data.Lessons.TryGetValue(id, out var lp))
        {
            lp = new LessonProgress();
            Data.Lessons[id] = lp;
        }
        return lp;
    }

    public static bool IsCompleted(string lessonId) => Data.Lessons.TryGetValue(lessonId, out var lp) && lp.Completed;

    public static void RecordMistake(string? key)
    {
        if (string.IsNullOrEmpty(key)) return;
        Data.Mistakes[key] = Data.Mistakes.TryGetValue(key, out var n) ? n + 1 : 1;
    }

    public static void RecordHit(string? key)
    {
        if (string.IsNullOrEmpty(key)) return;
        if (Data.Mistakes.TryGetValue(key, out var n))
        {
            if (n <= 1) Data.Mistakes.Remove(key);
            else Data.Mistakes[key] = n - 1;
        }
    }

    // ---------- SRS ----------
    public static void AddToSrs(VocabItem v, string kind = "vocab")
    {
        if (Data.Srs.ContainsKey(v.Key)) return;
        Data.Srs[v.Key] = new SrsItem
        {
            Key = v.Key,
            Kind = kind,
            Front = v.Jp,
            Reading = v.Reading,
            Back = v.Meaning,
            Box = 0,
            Due = DateTime.Today,
        };
    }

    public static void AddKanjiToSrs(KanjiEntry k)
    {
        var key = "k:" + k.Char;
        if (Data.Srs.ContainsKey(key)) return;
        Data.Srs[key] = new SrsItem
        {
            Key = key,
            Kind = "kanji",
            Front = k.Char,
            Reading = string.Join(" / ", new[] { k.On, k.Kun }.Where(s => !string.IsNullOrWhiteSpace(s))),
            Back = k.Meaning,
            Extra = string.Join("   ", k.Words.Take(2).Select(w => $"{w.Jp}（{w.Reading}）{w.Meaning}")),
            Due = DateTime.Today,
        };
    }

    public static List<SrsItem> DueItems() =>
        Data.Srs.Values.Where(s => s.Due <= DateTime.Now).OrderBy(s => s.Due).ThenBy(s => s.Box).ToList();

    public static int DueCount => Data.Srs.Values.Count(s => s.Due <= DateTime.Now);

    /// <summary>grade: 0 = errei, 1 = difícil, 2 = bom, 3 = fácil</summary>
    public static void Grade(SrsItem item, int grade)
    {
        item.Reviews++;
        switch (grade)
        {
            case 0:
                item.Lapses++;
                item.Box = Math.Max(0, item.Box - 2);
                item.Due = DateTime.Now.AddMinutes(5);
                return;
            case 1:
                item.Box = Math.Max(1, item.Box);
                break;
            case 2:
                item.Box = Math.Min(Intervals.Length - 1, item.Box + 1);
                break;
            default:
                item.Box = Math.Min(Intervals.Length - 1, item.Box + 2);
                break;
        }
        var days = Intervals[item.Box];
        if (grade == 1) days = Math.Max(1, days / 2);
        item.Due = DateTime.Today.AddDays(Math.Max(1, days));
    }

    public static string BoxLabel(int box) => box switch
    {
        0 => "novo",
        <= 2 => "aprendendo",
        <= 5 => "jovem",
        _ => "maduro"
    };
}
