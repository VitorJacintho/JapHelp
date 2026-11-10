using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Guia de frases para situações reais no Japão.</summary>
public class PhrasesView : UserControl
{
    private readonly StackPanel _list;
    private readonly FlowLayoutPanel _cats;
    private readonly TextBox _search;
    private PhraseCategory? _current;

    public PhrasesView()
    {
        BackColor = Theme.Background;

        var left = new Panel { Dock = DockStyle.Left, Width = Theme.S(290), BackColor = Color.White, Padding = Theme.Pad(12, 20, 12, 12) };
        _cats = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = Color.White };
        var leftTitle = new Label { Dock = DockStyle.Top, Height = Theme.S(40), Text = "Situações", Font = Theme.Ui(14f, FontStyle.Bold), ForeColor = Theme.Text, Padding = Theme.Pad(6, 0, 0, 0) };
        left.Controls.Add(_cats);
        left.Controls.Add(leftTitle);

        foreach (var c in ContentRepository.Phrases)
        {
            var cat = c;
            var b = new FlatButton
            {
                Text = $"{c.Icon}   {c.Name}  ({c.Phrases.Count})",
                BaseColor = Color.White,
                HoverColor = Theme.IndigoSoft,
                ForeColor = Theme.Text,
                TextAlign = ContentAlignment.MiddleLeft,
                Font = Theme.Jp(10f),
                TextPadding = new Padding(10, 4, 6, 4),
                Width = Theme.S(256),
                Height = Theme.S(42),
                Tag = c,
                Margin = new Padding(0, 0, 0, Theme.S(4)),
            };
            b.Click += (_, _) => ShowCategory(cat);
            _cats.Controls.Add(b);
        }

        var top = new Panel { Dock = DockStyle.Top, Height = Theme.S(104), BackColor = Theme.Background, Padding = Theme.Pad(28, 20, 28, 0) };
        var title = Ui.Title("Frases úteis para o Japão");
        title.Location = new Point(Theme.S(28), Theme.S(16));
        _search = new TextBox { Font = Theme.Jp(12f), PlaceholderText = "Buscar frase (português, romaji ou japonês)…", Width = Theme.S(420), Location = new Point(Theme.S(30), Theme.S(62)) };
        _search.TextChanged += (_, _) => DoSearch();
        top.Controls.Add(title);
        top.Controls.Add(_search);

        _list = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(28, 8, 28, 20), Spacing = 8, MaxContentWidth = Theme.S(900) };

        Controls.Add(_list);
        Controls.Add(top);
        Controls.Add(left);

        if (ContentRepository.Phrases.Count > 0) ShowCategory(ContentRepository.Phrases[0]);
        else _list.Add(new InfoBox("Arquivo Content/frases.json não encontrado.", Theme.Ui(11f), Theme.Error, Theme.ErrorSoft));
    }

    private void Highlight()
    {
        foreach (FlatButton b in _cats.Controls)
        {
            bool active = b.Tag == _current;
            b.BaseColor = active ? Theme.AccentSoft : Color.White;
            b.ForeColor = active ? Theme.AccentDark : Theme.Text;
            b.Invalidate();
        }
    }

    private void ShowCategory(PhraseCategory cat)
    {
        _current = cat;
        Highlight();
        _list.SuspendLayout();
        foreach (Control c in _list.Controls.Cast<Control>().ToList()) c.Dispose();
        _list.Controls.Clear();

        _list.Add(Ui.Label($"{cat.Icon}  {cat.Name}", Theme.Jp(16f, FontStyle.Bold), Theme.Accent));
        var items = cat.Items.ToList();
        var quiz = FlatButton.Primary("Quiz desta situação", (_, _) => StartQuiz(cat));
        quiz.Glyph = Glyphs.Play;
        quiz.FitWidth();
        var add = FlatButton.Secondary("Adicionar todas à revisão", null);
        add.Click += (_, _) =>
        {
            foreach (var v in items) ProgressStore.AddToSrs(v, "frase");
            ProgressStore.Save();
            add.Text = "✓ Adicionadas à revisão";
            add.FitWidth();
            add.Enabled = false;
        };
        var play = FlatButton.Secondary("Ouvir todas", (_, _) => Speech.SpeakQueue(items.Select(i => i.Jp)));
        play.Glyph = Glyphs.Volume;
        play.FitWidth();
        play.Enabled = Speech.Available;
        var speak = FlatButton.Secondary("Treinar fala", (_, _) => MainForm.Instance.ShowView(new SpeakingView("Frases úteis: " + cat.Name, items), "speak"));
        speak.Glyph = "";
        speak.FitWidth();
        _list.Add(Ui.Row(quiz, add, play, speak));

        foreach (var p in cat.Phrases.Where(p => p.Length >= 3))
        {
            var meaning = p.Length >= 4 && !string.IsNullOrWhiteSpace(p[3]) ? $"{p[2]}\n💡 {p[3]}" : p[2];
            _list.Add(new SentenceCard(p[0], p[1], meaning));
        }
        _list.ResumeLayout(true);
    }

    private void DoSearch()
    {
        var q = _search.Text.Trim();
        if (q.Length < 2)
        {
            if (_current != null) ShowCategory(_current);
            return;
        }
        var fq = Kana.Fold(q);
        var kq = Kana.ToHiragana(Kana.RomajiToHiragana(q.ToLowerInvariant()));
        var hits = ContentRepository.Phrases
            .SelectMany(c => c.Phrases.Where(p => p.Length >= 3).Select(p => (c, p)))
            .Where(x => Kana.Fold(x.p[2]).Contains(fq) || x.p[0].Contains(q) || Kana.ToHiragana(x.p[1]).Replace(" ", "").Contains(kq.Replace(" ", "")) ||
                        Kana.ToRomaji(x.p[1]).Replace(" ", "").Contains(q.ToLowerInvariant().Replace(" ", "")))
            .Take(60).ToList();

        _list.SuspendLayout();
        foreach (Control c in _list.Controls.Cast<Control>().ToList()) c.Dispose();
        _list.Controls.Clear();
        _list.Add(Ui.Label($"{hits.Count} resultado(s) para \"{q}\"", Theme.Ui(13f, FontStyle.Bold), Theme.Indigo));
        foreach (var (c, p) in hits)
            _list.Add(new SentenceCard(p[0], p[1], $"{p[2]}   ·   [{c.Name}]"));
        _list.ResumeLayout(true);
    }

    private static void StartQuiz(PhraseCategory cat)
    {
        var items = cat.Items.ToList();
        MainForm.Instance.RunExercises("Frases: " + cat.Name, () => ExerciseFactory.PhraseDrill(items, Math.Min(15, items.Count)), r =>
        {
            ProgressStore.AddXp(r.Correct * 2);
            return $"+{r.Correct * 2} XP";
        }, () =>
        {
            var v = new PhrasesView();
            MainForm.Instance.ShowView(v, "phrases");
            v.ShowCategory(ContentRepository.Phrases.FirstOrDefault(p => p.Name == cat.Name) ?? cat);
        }, "phrases");
    }
}
