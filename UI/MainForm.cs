using System.Drawing.Drawing2D;
using JapHelp.Core;
using JapHelp.UI.Views;

namespace JapHelp.UI;

public class MainForm : Form
{
    public static MainForm Instance { get; private set; } = null!;

    private readonly Panel _host;
    private readonly List<NavButton> _navs = new();
    private readonly Label _stats;
    private Control? _current;

    public MainForm()
    {
        Instance = this;
        Text = "JapHelp — Curso de Japonês para Intercâmbio";
        BackColor = Theme.Background;
        Font = Theme.Ui(10f);
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(Theme.S(1320), Theme.S(860));
        MinimumSize = new Size(Theme.S(1000), Theme.S(640));
        KeyPreview = false;

        var sidebar = new Panel { Dock = DockStyle.Left, Width = Theme.S(224), BackColor = Theme.Sidebar };
        var logo = new Panel { Dock = DockStyle.Top, Height = Theme.S(110), BackColor = Theme.Sidebar };
        logo.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using var red = new SolidBrush(Theme.Accent);
            g.FillEllipse(red, Theme.S(20), Theme.S(26), Theme.S(52), Theme.S(52));
            TextRenderer.DrawText(g, "日", Theme.Jp(20f, FontStyle.Bold), new Rectangle(Theme.S(20), Theme.S(26), Theme.S(52), Theme.S(52)), Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            TextRenderer.DrawText(g, "JapHelp", Theme.Ui(16f, FontStyle.Bold), new Point(Theme.S(82), Theme.S(28)), Color.White);
            TextRenderer.DrawText(g, "日本語コース", Theme.Jp(9.5f), new Point(Theme.S(84), Theme.S(58)), Color.FromArgb(170, 175, 195));
        };

        var nav = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            BackColor = Theme.Sidebar,
            Padding = Theme.Pad(10, 6, 10, 6),
            AutoScroll = true,
        };
        AddNav(nav, "家", "Início", "home", () => new HomeView());
        AddNav(nav, "道", "Curso", "course", () => new CourseView());
        AddNav(nav, "あ", "Hiragana & Katakana", "kana", () => new KanaView());
        AddNav(nav, "語", "Vocabulário", "vocab", () => new VocabView());
        AddNav(nav, "漢", "Kanji", "kanji", () => new KanjiView());
        AddNav(nav, "復", "Revisão (SRS)", "review", () => new ReviewView());
        AddNav(nav, "声", "Treino de fala", "speak", () => new SpeakingView());
        AddNav(nav, "話", "Frases úteis", "phrases", () => new PhrasesView());
        AddNav(nav, "辞", "Dicionário", "dict", () => new DictionaryView());
        AddNav(nav, "設", "Configurações", "settings", () => new SettingsView());

        _stats = new Label
        {
            Dock = DockStyle.Bottom,
            Height = Theme.S(78),
            ForeColor = Color.FromArgb(200, 204, 220),
            Font = Theme.Ui(9.5f),
            Padding = Theme.Pad(20, 8, 12, 12),
            BackColor = Color.FromArgb(24, 26, 38),
        };

        sidebar.Controls.Add(nav);
        sidebar.Controls.Add(_stats);
        sidebar.Controls.Add(logo);

        _host = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Background };
        Controls.Add(_host);
        Controls.Add(sidebar);

        ProgressStore.Changed += UpdateStats;
        UpdateStats();
        Navigate("home");
        FormClosing += (_, _) => { Speech.Stop(); ProgressStore.Save(); };
    }

    private void AddNav(FlowLayoutPanel nav, string icon, string text, string key, Func<Control> factory)
    {
        var b = new NavButton(icon, text, key, factory) { Width = Theme.S(200) };
        b.Click += (_, _) => Navigate(key);
        _navs.Add(b);
        nav.Controls.Add(b);
    }

    private void UpdateStats()
    {
        var d = ProgressStore.Data;
        int done = d.Lessons.Values.Count(l => l.Completed);
        int total = ContentRepository.AllLessons.Count();
        _stats.Text = $"🔥 {d.Streak} dia(s) seguidos\n⭐ {d.Xp} XP  ·  hoje {ProgressStore.TodayXp}/{d.Settings.DailyGoalXp}\n📘 {done}/{total} lições";
    }

    public void Navigate(string key)
    {
        var nb = _navs.FirstOrDefault(n => n.Key == key);
        if (nb == null) return;
        ShowView(nb.Factory(), key);
    }

    public void ShowView(Control view, string? navKey = null)
    {
        Speech.Stop();
        SuspendLayout();
        var old = _current;
        view.Dock = DockStyle.Fill;
        _host.Controls.Add(view);
        view.BringToFront();
        _current = view;
        if (old != null)
        {
            _host.Controls.Remove(old);
            old.Dispose();
        }
        if (navKey != null)
            foreach (var n in _navs) { n.Active = n.Key == navKey; n.Invalidate(); }
        ResumeLayout(true);
        UpdateStats();
    }

    public void OpenLesson(Lesson lesson, string tab = "theory") => ShowView(new LessonView(lesson, tab), "course");

    public void RunExercises(string title, Func<List<Exercise>> generator, Func<RunResult, string?>? onComplete, Action onExit, string navKey)
    {
        ShowView(new ExerciseRunner(title, generator, onComplete, onExit), navKey);
    }
}

public class NavButton : Control
{
    public string Icon { get; }
    public string Key { get; }
    public Func<Control> Factory { get; }
    public bool Active { get; set; }
    private bool _hover;

    public NavButton(string icon, string text, string key, Func<Control> factory)
    {
        Icon = icon;
        Text = text;
        Key = key;
        Factory = factory;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Height = Theme.S(46);
        Margin = new Padding(0, 0, 0, Theme.S(4));
        Cursor = Cursors.Hand;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.Sidebar);
        if (Active || _hover)
        {
            using var path = Theme.RoundRect(new RectangleF(0, 0, Width - 1, Height - 1), Theme.S(8));
            using var b = new SolidBrush(Active ? Theme.SidebarActive : Theme.SidebarHover);
            g.FillPath(b, path);
        }
        var iconRect = new Rectangle(Theme.S(8), Theme.S(7), Theme.S(32), Theme.S(32));
        using (var ib = new SolidBrush(Active ? Color.FromArgb(60, 255, 255, 255) : Color.FromArgb(50, 56, 80)))
            g.FillEllipse(ib, iconRect);
        TextRenderer.DrawText(g, Icon, Theme.Jp(12f, FontStyle.Bold), iconRect, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(g, Text, Active ? Theme.UiSemi(10.5f) : Theme.Ui(10.5f), new Rectangle(Theme.S(50), 0, Width - Theme.S(54), Height),
            Active ? Color.White : Color.FromArgb(205, 208, 222), TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}
