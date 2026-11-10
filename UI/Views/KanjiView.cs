using JapHelp.Core;

namespace JapHelp.UI.Views;

public class KanjiView : UserControl
{
    private string _level;
    private readonly StackPanel _list;
    private readonly StackPanel _detail;
    private readonly FlowLayoutPanel _levels;

    public KanjiView(string? level = null)
    {
        BackColor = Theme.Background;
        var levels = ContentRepository.Kanji.Select(k => k.Level).Distinct()
            .OrderBy(l => l switch { "N5" => 0, "N4" => 1, "N3" => 2, "N2" => 3, _ => 9 }).ToList();
        _level = level != null && levels.Contains(level) ? level : levels.FirstOrDefault() ?? "";

        _detail = new StackPanel { Dock = DockStyle.Right, Width = Theme.S(380), BackColor = Color.White, Padding = Theme.Pad(22, 22, 22, 22), Spacing = 8 };

        var top = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Theme.S(124), Padding = Theme.Pad(32, 22, 32, 0), BackColor = Theme.Background };
        var title = Ui.Title("Kanji");
        title.Margin = new Padding(0, 0, Theme.S(24), 0);
        top.Controls.Add(title);
        _levels = new FlowLayoutPanel { AutoSize = true, BackColor = Color.Transparent, Margin = new Padding(0, Theme.S(4), 0, 0) };
        foreach (var l in levels)
        {
            var b = FlatButton.Secondary(LevelName(l), (_, _) => SetLevel(l));
            b.Tag = l;
            b.Margin = new Padding(0, 0, Theme.S(8), 0);
            _levels.Controls.Add(b);
        }
        top.Controls.Add(_levels);
        top.SetFlowBreak(_levels, true);
        top.Controls.Add(Ui.Label("Estude um grupo por vez: veja os detalhes, trace cada kanji e faça o quiz. Com 70%+ os kanji entram na revisão (SRS).",
            Theme.Ui(10f), Theme.Muted, new Padding(0, Theme.S(10), 0, 0)));

        _list = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(32, 4, 20, 20), Spacing = 6 };

        Controls.Add(_list);
        Controls.Add(_detail);
        Controls.Add(top);

        if (ContentRepository.Kanji.Count == 0)
            _list.Add(new InfoBox("Arquivo Content/kanji.txt não encontrado ou vazio.", Theme.Ui(11f), Theme.Error, Theme.ErrorSoft));
        else
            SetLevel(_level);
    }

    private static string LevelName(string l) => l switch
    {
        "N5" => "N5 · iniciante",
        "N4" => "N4 · básico",
        "N3" => "N3 · intermediário",
        _ => l
    };

    private void SetLevel(string level)
    {
        _level = level;
        foreach (FlatButton b in _levels.Controls)
        {
            bool active = (string)b.Tag! == level;
            b.BaseColor = active ? Theme.Indigo : Color.White;
            b.ForeColor = active ? Color.White : Theme.Text;
            b.HoverColor = active ? Theme.Blend(Theme.Indigo, Color.Black, 0.1f) : Theme.IndigoSoft;
            b.BorderColor = active ? Color.Empty : Theme.Border;
            b.Invalidate();
        }
        BuildList();
        var first = ContentRepository.Kanji.FirstOrDefault(k => k.Level == level);
        if (first != null) ShowDetail(first);
    }

    private void BuildList()
    {
        _list.SuspendLayout();
        foreach (Control c in _list.Controls.Cast<Control>().ToList()) c.Dispose();
        _list.Controls.Clear();
        var items = ContentRepository.Kanji.Where(k => k.Level == _level).ToList();
        foreach (var group in items.GroupBy(k => k.Group))
        {
            var set = group.ToList();
            var gkey = $"{_level}:{group.Key}";
            bool done = ProgressStore.Data.KanjiGroupsDone.Contains(gkey);
            var label = Ui.Label($"{(done ? "✓ " : "")}Grupo {group.Key + 1}", Theme.Ui(12.5f, FontStyle.Bold), done ? Theme.Success : Theme.Indigo);
            label.Margin = new Padding(0, Theme.S(8), Theme.S(12), 0);
            var quiz = FlatButton.Secondary("Quiz do grupo", (_, _) => StartQuiz(set, gkey));
            quiz.Glyph = Glyphs.Play;
            quiz.FitWidth();
            var trace = FlatButton.Secondary("Traçar", (_, _) => TracingForm.Open(set.Select(k => k.Char).ToList(), 0, c => ContentRepository.Kanji.FirstOrDefault(k => k.Char == c)?.Meaning ?? ""));
            trace.Glyph = Glyphs.Pen;
            trace.FitWidth();
            _list.Add(Ui.Row(label, quiz, trace));
            var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent };
            foreach (var k in set)
            {
                var meaning = k.Meaning.Split(';', ',')[0].Trim();
                var tile = new CharTile(k.Char, meaning, 78) { CharSize = 26f, Weak = ProgressStore.Data.Mistakes.GetValueOrDefault("k:" + k.Char) };
                tile.Click += (_, _) => ShowDetail(k);
                tile.DoubleClick += (_, _) => TracingForm.Open(set.Select(x => x.Char).ToList(), set.IndexOf(k), c => set.FirstOrDefault(x => x.Char == c)?.Meaning ?? "");
                flow.Controls.Add(tile);
            }
            _list.Add(flow);
        }
        _list.ResumeLayout(true);
    }

    private void ShowDetail(KanjiEntry k)
    {
        _detail.SuspendLayout();
        foreach (Control c in _detail.Controls.Cast<Control>().ToList()) c.Dispose();
        _detail.Controls.Clear();
        var big = Ui.Label(k.Char, Theme.Jp(64f), Theme.Text);
        big.Tag = "center";
        _detail.Add(big);
        var mean = Ui.Label(k.Meaning, Theme.Ui(14f, FontStyle.Bold), Theme.Accent);
        mean.Tag = "center";
        _detail.Add(mean);
        _detail.Add(new InfoBox($"音読み on'yomi (leitura chinesa):  {Dash(k.On)}\n訓読み kun'yomi (leitura japonesa):  {Dash(k.Kun)}", Theme.Jp(11f), Theme.Text, Theme.IndigoSoft));
        var row = Ui.Row(
            FlatButton.Icon(Glyphs.Volume, "Ouvir", (_, _) => Speech.Speak(k.Words.FirstOrDefault()?.Jp ?? k.Char)),
            FlatButton.Secondary("Traçar", (_, _) => TracingForm.Open(new List<string> { k.Char }, 0, _ => k.Meaning)));
        _detail.Add(row);
        if (k.Words.Count > 0)
        {
            _detail.Add(Ui.Section("Palavras com este kanji"));
            foreach (var w in k.Words)
                _detail.Add(new SentenceCard(w.Jp, w.Reading, w.Meaning));
        }
        _detail.Add(new InfoBox("On'yomi (katakana) costuma aparecer em palavras compostas de 2+ kanji (ex.: 日本). " +
                                "Kun'yomi (hiragana) aparece quando o kanji está sozinho ou com okurigana (ex.: 食べる).",
            Theme.Ui(9.5f), Theme.Muted, Theme.Background));
        _detail.ResumeLayout(true);
    }

    private static string Dash(string s) => string.IsNullOrWhiteSpace(s) ? "—" : s;

    private void StartQuiz(List<KanjiEntry> set, string gkey)
    {
        var level = _level;
        MainForm.Instance.RunExercises("Quiz de kanji", () => ExerciseFactory.KanjiDrill(set), r =>
        {
            int xp = r.Correct * 2;
            string msg = $"+{xp} XP";
            if (r.Percent >= 70)
            {
                if (ProgressStore.Data.KanjiGroupsDone.Add(gkey)) xp += 15;
                foreach (var k in set) ProgressStore.AddKanjiToSrs(k);
                msg = $"+{xp} XP · Grupo concluído! Os kanji entraram na sua revisão.";
            }
            ProgressStore.AddXp(xp);
            return msg;
        }, () => MainForm.Instance.ShowView(new KanjiView(level), "kanji"), "kanji");
    }
}
