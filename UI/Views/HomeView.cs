using System.Drawing.Drawing2D;
using JapHelp.Core;

namespace JapHelp.UI.Views;

public class HomeView : UserControl
{
    public HomeView()
    {
        BackColor = Theme.Background;
        var stack = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(36, 28, 36, 28), MaxContentWidth = Theme.S(1100), Spacing = 12 };
        Controls.Add(stack);

        var d = ProgressStore.Data;
        int hour = DateTime.Now.Hour;
        string greet = hour < 11 ? "おはようございます！" : hour < 18 ? "こんにちは！" : "こんばんは！";
        stack.Add(Ui.Label(greet, Theme.Jp(24f, FontStyle.Bold), Theme.Accent));
        stack.Add(Ui.Subtitle("Seu curso de japonês do zero ao avançado, focado em quem vai fazer intercâmbio."));

        foreach (var err in ContentRepository.Errors)
            stack.Add(new InfoBox("Erro ao carregar conteúdo: " + err, Theme.Ui(10f), Theme.Error, Theme.ErrorSoft));

        // ---- estatísticas
        int done = d.Lessons.Values.Count(l => l.Completed);
        int total = ContentRepository.AllLessons.Count();
        var stats = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent, Margin = new Padding(0, Theme.S(6), 0, 0) };
        stats.Controls.Add(new StatTile("🔥", d.Streak.ToString(), d.Streak == 1 ? "dia seguido" : "dias seguidos", Theme.Accent));
        stats.Controls.Add(new StatTile("⭐", d.Xp.ToString(), "XP total", Theme.Warning));
        stats.Controls.Add(new StatTile("📘", $"{done}/{total}", "lições concluídas", Theme.Indigo));
        stats.Controls.Add(new StatTile("🔁", ProgressStore.DueCount.ToString(), "revisões para hoje", Theme.Success));
        stack.Add(stats);

        // ---- meta diária
        int today = ProgressStore.TodayXp;
        int goal = Math.Max(10, d.Settings.DailyGoalXp);
        stack.Add(Ui.Label(today >= goal ? $"Meta diária cumprida! 🎉  {today}/{goal} XP" : $"Meta diária: {today}/{goal} XP",
            Theme.UiSemi(11f), today >= goal ? Theme.Success : Theme.Text, new Padding(0, Theme.S(6), 0, 0)));
        stack.Add(new ProgressLine { Value = (float)today / goal, BarColor = today >= goal ? Theme.Success : Theme.Warning });

        // ---- continuar
        var next = ContentRepository.NextRecommended();
        if (next != null)
        {
            stack.Add(Ui.Section("Continuar de onde parou"));
            var card = new LessonCard(next, true) { Height = Theme.S(104) };
            card.Click += (_, _) => MainForm.Instance.OpenLesson(next);
            stack.Add(card);
        }
        else if (total > 0)
        {
            stack.Add(new InfoBox("Você concluiu todas as lições! 🎌 Continue revisando no SRS e praticando kanji e frases. おめでとう！", Theme.UiSemi(12f), Theme.Success, Theme.SuccessSoft));
        }

        // ---- ações rápidas
        stack.Add(Ui.Section("Prática rápida"));
        var due = ProgressStore.DueCount;
        var reviewBtn = FlatButton.Primary($"Revisar agora ({due})", (_, _) => MainForm.Instance.Navigate("review"));
        reviewBtn.BaseColor = Theme.Success;
        reviewBtn.HoverColor = Theme.Blend(Theme.Success, Color.Black, 0.15f);
        var weakCount = d.Mistakes.Count;
        var weakBtn = FlatButton.Secondary($"Treinar pontos fracos ({weakCount})", (_, _) => StartWeakSpots());
        weakBtn.Enabled = weakCount > 0;
        stack.Add(Ui.Row(
            reviewBtn,
            weakBtn,
            FlatButton.Secondary("Quiz de kana", (_, _) => MainForm.Instance.Navigate("kana")),
            FlatButton.Secondary("Frases para o dia a dia", (_, _) => MainForm.Instance.Navigate("phrases"))));

        // ---- dica
        if (ContentRepository.Tips.Count > 0)
        {
            var tip = ContentRepository.Tips[DateTime.Today.DayOfYear % ContentRepository.Tips.Count];
            stack.Add(new InfoBox("💡 Dica do dia: " + tip, Theme.Jp(10.5f), Color.FromArgb(110, 75, 0), Theme.WarningSoft));
        }

        if (!Speech.Available)
        {
            stack.Add(new InfoBox(
                "🔇 Nenhuma voz japonesa encontrada no Windows. Os exercícios de áudio ficam desativados até você instalar uma.\n" +
                "Como instalar: Configurações do Windows → Hora e idioma → Idioma → Adicionar um idioma → Japonês (marque \"Conversão de texto em fala\"). " +
                "Depois reabra o JapHelp.",
                Theme.Ui(10.5f), Theme.AccentDark, Theme.ErrorSoft));
            var open = FlatButton.Secondary("Abrir configurações de idioma/fala", (_, _) => Speech.OpenWindowsSpeechSettings());
            open.Tag = "fixed";
            stack.Add(open);
        }

        // ---- progresso por nível
        stack.Add(Ui.Section("Progresso por nível"));
        foreach (var m in ContentRepository.Modules)
        {
            int c = m.Lessons.Count(l => ProgressStore.IsCompleted(l.Id));
            var color = Theme.FromHex(m.Color, Theme.Accent);
            stack.Add(Ui.Label($"{m.Title}   ·   {c}/{m.Lessons.Count}", Theme.UiSemi(10.5f), Theme.Text, new Padding(0, Theme.S(4), 0, 0)));
            stack.Add(new ProgressLine { Value = m.Lessons.Count == 0 ? 0 : (float)c / m.Lessons.Count, BarColor = color, Height = Theme.S(10) });
        }
    }

    public static void StartWeakSpots()
    {
        MainForm.Instance.RunExercises("Pontos fracos", WeakSpotExercises,
            r =>
            {
                ProgressStore.AddXp(r.Correct * 2);
                return $"+{r.Correct * 2} XP";
            },
            () => MainForm.Instance.Navigate("home"), "home");
    }

    public static List<Exercise> WeakSpotExercises()
    {
        var keys = ProgressStore.Data.Mistakes.OrderByDescending(kv => kv.Value).Take(20).Select(kv => kv.Key).ToList();
        var result = new List<Exercise>();
        var kanaUnits = keys.Where(k => k.StartsWith("kana:")).Select(k => k[5..]).ToList();
        if (kanaUnits.Count > 0) result.AddRange(ExerciseFactory.KanaDrill(kanaUnits, Math.Min(10, kanaUnits.Count * 2)));
        var vocab = ContentRepository.AllVocab.Concat(ContentRepository.Decks.SelectMany(d => d.Items)).Concat(ContentRepository.Phrases.SelectMany(p => p.Items)).Concat(ContentRepository.Kanji.SelectMany(k => k.Words))
            .GroupBy(v => v.Key).ToDictionary(g => g.Key, g => g.First());
        var all = vocab.Values.ToList();
        int i = 0;
        foreach (var k in keys.Where(k => k.StartsWith("v:")))
            if (vocab.TryGetValue(k, out var v)) result.Add(ExerciseFactory.VocabExercise(v, i++ % 3, all, all));
        var kanji = keys.Where(k => k.StartsWith("k:")).Select(k => ContentRepository.Kanji.FirstOrDefault(x => "k:" + x.Char == k)).Where(x => x != null).Cast<KanjiEntry>().ToList();
        if (kanji.Count > 0) result.AddRange(ExerciseFactory.KanjiDrill(kanji).Take(10));
        return ExerciseFactory.Shuffle(result);
    }
}

public class StatTile : Control
{
    private readonly string _icon, _value, _label;
    private readonly Color _color;

    public StatTile(string icon, string value, string label, Color color)
    {
        _icon = icon; _value = value; _label = label; _color = color;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
        Size = new Size(Theme.S(206), Theme.S(92));
        Margin = new Padding(0, 0, Theme.S(12), Theme.S(12));
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        using (var path = Theme.RoundRect(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), Theme.S(12)))
        {
            using var b = new SolidBrush(Color.White);
            g.FillPath(b, path);
            using var p = new Pen(Theme.Border);
            g.DrawPath(p, path);
        }
        using (var bar = new SolidBrush(_color))
            g.FillRectangle(bar, Theme.S(0), Theme.S(18), Theme.S(4), Height - Theme.S(36));
        TextRenderer.DrawText(g, _icon, Theme.Get("Segoe UI Emoji", 18f, FontStyle.Regular), new Rectangle(Theme.S(14), 0, Theme.S(44), Height), _color,
            TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter);
        TextRenderer.DrawText(g, _value, Theme.Ui(20f, FontStyle.Bold), new Point(Theme.S(62), Theme.S(14)), Theme.Text);
        TextRenderer.DrawText(g, _label, Theme.Ui(9.5f), new Point(Theme.S(64), Theme.S(56)), Theme.Muted);
    }
}

public class LessonCard : Control
{
    private readonly Lesson _lesson;
    private readonly bool _wide;
    private bool _hover;

    public LessonCard(Lesson lesson, bool wide = false)
    {
        _lesson = lesson;
        _wide = wide;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(Theme.S(300), Theme.S(100));
        Margin = new Padding(0, 0, Theme.S(12), Theme.S(12));
        Cursor = Cursors.Hand;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var color = Theme.FromHex(_lesson.Module.Color, Theme.Accent);
        var lp = ProgressStore.Data.Lessons.GetValueOrDefault(_lesson.Id);
        bool done = lp?.Completed == true;

        using (var path = Theme.RoundRect(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), Theme.S(12)))
        {
            using var b = new SolidBrush(done ? Theme.Blend(Color.White, color, 0.06f) : Color.White);
            g.FillPath(b, path);
            using var p = new Pen(_hover ? color : Theme.Border, _hover ? 2 : 1);
            g.DrawPath(p, path);
        }

        var circle = new Rectangle(Theme.S(14), (Height - Theme.S(44)) / 2, Theme.S(44), Theme.S(44));
        using (var cb = new SolidBrush(done ? color : Theme.Blend(Color.White, color, 0.15f)))
            g.FillEllipse(cb, circle);
        TextRenderer.DrawText(g, done ? "✓" : (_lesson.Index + 1).ToString(), Theme.Ui(done ? 15f : 13f, FontStyle.Bold), circle,
            done ? Color.White : color, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        int x = Theme.S(70);
        int w = Width - x - Theme.S(12);
        if (_wide)
            TextRenderer.DrawText(g, _lesson.Module.Title, Theme.Ui(9f, FontStyle.Bold), new Rectangle(x, Theme.S(10), w, Theme.S(18)), color, TextFormatFlags.EndEllipsis);
        int ty = _wide ? Theme.S(28) : Theme.S(14);
        TextRenderer.DrawText(g, _lesson.Title, Theme.UiSemi(11.5f), new Rectangle(x, ty, w, Theme.S(24)), Theme.Text, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g, _lesson.Subtitle, Theme.Jp(9.5f), new Rectangle(x, ty + Theme.S(24), w, Theme.S(36)), Theme.Muted,
            TextFormatFlags.WordBreak | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        if (lp != null && lp.Attempts > 0)
        {
            var s = done ? $"Concluída · {lp.BestScore}%" : $"Melhor: {lp.BestScore}%";
            TextRenderer.DrawText(g, s, Theme.Ui(8.5f, FontStyle.Bold), new Rectangle(x, Height - Theme.S(22), w, Theme.S(18)), done ? Theme.Success : Theme.Warning, TextFormatFlags.Right);
        }
    }
}
