using JapHelp.Core;

namespace JapHelp.UI.Views;

public class KanaView : UserControl
{
    private bool _katakana;
    private readonly StackPanel _tables;
    private readonly CheckedListBox _groups;
    private readonly FlatButton _hiraBtn, _kataBtn;

    private static readonly List<(string Name, Func<IEnumerable<string>> Units)> GroupDefs = new()
    {
        ("あ い う え お (vogais)", () => Row(0)),
        ("か行  k", () => Row(1)),
        ("さ行  s", () => Row(2)),
        ("た行  t", () => Row(3)),
        ("な行  n", () => Row(4)),
        ("は行  h", () => Row(5)),
        ("ま行  m", () => Row(6)),
        ("や・ら・わ・ん", () => Row(7).Concat(Row(8)).Concat(Row(9)).Concat(Row(10))),
        ("Dakuten: が ざ だ ば ぱ", () => Kana.DakutenRows.SelectMany(r => r.Kana).Where(k => k != "ぢ" && k != "づ")),
        ("Combinações: きゃ しゃ ちゃ…", () => Kana.YoonRows.SelectMany(r => r.Kana)),
    };

    private static IEnumerable<string> Row(int i) => Kana.GojuonRows[i].Kana.Where(k => k != "");

    public KanaView()
    {
        BackColor = Theme.Background;

        // ---- painel lateral (quiz)
        var side = new StackPanel { Dock = DockStyle.Right, Width = Theme.S(320), BackColor = Color.White, Padding = Theme.Pad(20, 24, 20, 20), Spacing = 10 };
        side.Add(Ui.Label("Quiz de kana", Theme.Ui(15f, FontStyle.Bold), Theme.Text));
        side.Add(Ui.Label("Marque os grupos que quer treinar:", Theme.Ui(10f), Theme.Muted));
        _groups = new CheckedListBox { CheckOnClick = true, BorderStyle = BorderStyle.None, Font = Theme.Jp(11f), Height = Theme.S(250), IntegralHeight = false };
        foreach (var g in GroupDefs) _groups.Items.Add(g.Name, _groups.Items.Count < 2);
        side.Add(_groups);
        side.Add(Ui.Row(
            FlatButton.Secondary("Todos", (_, _) => SetAll(true)),
            FlatButton.Secondary("Nenhum", (_, _) => SetAll(false))));
        var start = FlatButton.Primary("Começar quiz (20)", (_, _) => StartQuiz(20));
        start.Glyph = Glyphs.Play;
        start.FitWidth();
        start.Tag = "fixed";
        side.Add(start);
        var weakKana = ProgressStore.Data.Mistakes.Keys.Where(k => k.StartsWith("kana:")).Select(k => k[5..]).ToList();
        var weak = FlatButton.Secondary($"Treinar kana que mais erro ({weakKana.Count})", (_, _) => StartWeak());
        weak.Enabled = weakKana.Count > 0;
        weak.Tag = "fixed";
        side.Add(weak);
        var trace = FlatButton.Secondary("Praticar escrita do grupo", (_, _) =>
        {
            var units = SelectedUnits();
            if (units.Count > 0) TracingForm.Open(units, 0);
        });
        trace.Glyph = Glyphs.Pen;
        trace.FitWidth();
        trace.Tag = "fixed";
        side.Add(trace);
        side.Add(new InfoBox("Dica: aprenda 1 linha por dia. Treine até reconhecer cada kana em menos de 2 segundos — " +
                             "isso faz toda a diferença para ler placas, cardápios e estações no Japão.", Theme.Ui(9.5f), Theme.Muted, Theme.Background));

        // ---- topo
        var top = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Theme.S(118), Padding = Theme.Pad(32, 22, 32, 0), BackColor = Theme.Background };
        var title = Ui.Title("Hiragana & Katakana");
        title.Margin = new Padding(0, 0, Theme.S(24), 0);
        _hiraBtn = FlatButton.Secondary("ひらがな  Hiragana", (_, _) => SetScript(false));
        _kataBtn = FlatButton.Secondary("カタカナ  Katakana", (_, _) => SetScript(true));
        _hiraBtn.Font = _kataBtn.Font = Theme.Jp(11f, FontStyle.Bold);
        _hiraBtn.FitWidth(); _kataBtn.FitWidth();
        _hiraBtn.Margin = _kataBtn.Margin = new Padding(0, Theme.S(4), Theme.S(8), 0);
        top.Controls.Add(title);
        top.Controls.Add(_hiraBtn);
        top.Controls.Add(_kataBtn);
        top.SetFlowBreak(_kataBtn, true);
        top.Controls.Add(Ui.Label("Clique em um kana para ouvir · duplo clique para traçar · ponto laranja = você costuma errar.", Theme.Ui(10f), Theme.Muted, new Padding(0, Theme.S(10), 0, 0)));

        _tables = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(32, 4, 20, 20), Spacing = 6 };

        Controls.Add(_tables);
        Controls.Add(side);
        Controls.Add(top);
        SetScript(false);
    }

    private void SetAll(bool v)
    {
        for (int i = 0; i < _groups.Items.Count; i++) _groups.SetItemChecked(i, v);
    }

    private string Conv(string k) => _katakana ? Kana.ToKatakana(k) : k;

    private void SetScript(bool katakana)
    {
        _katakana = katakana;
        foreach (var (b, active) in new[] { (_hiraBtn, !katakana), (_kataBtn, katakana) })
        {
            b.BaseColor = active ? Theme.Accent : Color.White;
            b.ForeColor = active ? Color.White : Theme.Text;
            b.HoverColor = active ? Theme.AccentDark : Theme.IndigoSoft;
            b.BorderColor = active ? Color.Empty : Theme.Border;
            b.Invalidate();
        }
        BuildTables();
    }

    private void BuildTables()
    {
        _tables.SuspendLayout();
        foreach (Control c in _tables.Controls.Cast<Control>().ToList()) c.Dispose();
        _tables.Controls.Clear();

        var allUnits = new List<string>();
        void AddSection(string title, IEnumerable<(string Row, string[] Kana)> rows, int tileSize)
        {
            _tables.Add(Ui.Section(title));
            foreach (var (_, kanas) in rows)
            {
                var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Color.Transparent, Margin = new Padding(0) };
                foreach (var k in kanas)
                {
                    var ch = k == "" ? "" : Conv(k);
                    var tile = new CharTile(ch, ch == "" ? "" : Kana.ToRomaji(ch), tileSize);
                    if (ch != "")
                    {
                        allUnits.Add(ch);
                        tile.Weak = ProgressStore.Data.Mistakes.GetValueOrDefault("kana:" + ch);
                        tile.Click += (_, _) => Speech.Speak(ch);
                        tile.DoubleClick += (_, _) => TracingForm.Open(allUnits, allUnits.IndexOf(ch));
                    }
                    flow.Controls.Add(tile);
                }
                _tables.Add(flow);
            }
        }
        AddSection("Básicos (gojūon)", Kana.GojuonRows, 66);
        AddSection("Com dakuten ゛ e handakuten ゜", Kana.DakutenRows, 66);
        AddSection("Combinações (yōon)", Kana.YoonRows, 80);
        if (_katakana)
        {
            _tables.Add(Ui.Section("Katakana para sons estrangeiros"));
            var ext = new[] { "ファ", "フィ", "フェ", "フォ", "ティ", "ディ", "トゥ", "ウィ", "ウェ", "ウォ", "シェ", "ジェ", "チェ", "ヴァ", "ヴ" };
            var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent };
            foreach (var e in ext)
            {
                var tile = new CharTile(e, Kana.ToRomaji(e), 80);
                tile.Click += (_, _) => Speech.Speak(e);
                flow.Controls.Add(tile);
            }
            _tables.Add(flow);
        }
        _tables.ResumeLayout(true);
    }

    private List<string> SelectedUnits()
    {
        var units = new List<string>();
        for (int i = 0; i < GroupDefs.Count; i++)
            if (_groups.GetItemChecked(i)) units.AddRange(GroupDefs[i].Units().Select(Conv));
        return units.Distinct().ToList();
    }

    private void StartQuiz(int count)
    {
        var units = SelectedUnits();
        if (units.Count == 0)
        {
            MessageBox.Show("Marque pelo menos um grupo.", "Quiz de kana");
            return;
        }
        var kata = _katakana;
        MainForm.Instance.RunExercises("Quiz de kana", () => ExerciseFactory.KanaDrill(units, count), r =>
        {
            ProgressStore.AddXp(r.Correct);
            return $"+{r.Correct} XP";
        }, () =>
        {
            var v = new KanaView();
            MainForm.Instance.ShowView(v, "kana");
            if (kata) v.SetScript(true);
        }, "kana");
    }

    private void StartWeak()
    {
        var weak = ProgressStore.Data.Mistakes.Where(kv => kv.Key.StartsWith("kana:")).OrderByDescending(kv => kv.Value).Take(15).Select(kv => kv.Key[5..]).ToList();
        if (weak.Count == 0) return;
        MainForm.Instance.RunExercises("Kana que você mais erra", () => ExerciseFactory.KanaDrill(weak, Math.Max(10, weak.Count * 2)), r =>
        {
            ProgressStore.AddXp(r.Correct);
            return $"+{r.Correct} XP";
        }, () => MainForm.Instance.Navigate("kana"), "kana");
    }
}
