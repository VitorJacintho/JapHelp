using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Decks de vocabulário por tema (N5, N4...), com quiz e envio para a revisão.</summary>
public class VocabView : UserControl
{
    private readonly FlowLayoutPanel _decks;
    private readonly StackPanel _detail;
    private VocabDeck? _current;

    public VocabView(string? deckKey = null)
    {
        BackColor = Theme.Background;

        var left = new Panel { Dock = DockStyle.Left, Width = Theme.S(300), BackColor = Color.White, Padding = Theme.Pad(12, 20, 8, 12) };
        _decks = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = Color.White };
        var title = new Label { Dock = DockStyle.Top, Height = Theme.S(40), Text = "Decks de vocabulário", Font = Theme.Ui(14f, FontStyle.Bold), ForeColor = Theme.Text, Padding = Theme.Pad(6, 0, 0, 0) };
        left.Controls.Add(_decks);
        left.Controls.Add(title);

        foreach (var group in ContentRepository.Decks.GroupBy(d => d.Level))
        {
            var header = new Label
            {
                Text = string.IsNullOrEmpty(group.Key) ? "Outros" : group.Key,
                Font = Theme.Ui(10.5f, FontStyle.Bold),
                ForeColor = Theme.Indigo,
                AutoSize = false,
                Width = Theme.S(240),
                Height = Theme.S(30),
                TextAlign = ContentAlignment.BottomLeft,
                Margin = new Padding(Theme.S(6), Theme.S(8), 0, Theme.S(2)),
            };
            _decks.Controls.Add(header);
            foreach (var d in group)
            {
                var deck = d;
                var b = new FlatButton
                {
                    BaseColor = Color.White,
                    HoverColor = Theme.IndigoSoft,
                    ForeColor = Theme.Text,
                    TextAlign = ContentAlignment.MiddleLeft,
                    Font = Theme.Jp(10f),
                    TextPadding = new Padding(10, 4, 6, 4),
                    Width = Theme.S(248),
                    Height = Theme.S(40),
                    Tag = d,
                    Margin = new Padding(0, 0, 0, Theme.S(3)),
                };
                b.Click += (_, _) => ShowDeck(deck);
                _decks.Controls.Add(b);
            }
        }
        RefreshButtons();

        _detail = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(28, 20, 24, 20), Spacing = 10 };
        Controls.Add(_detail);
        Controls.Add(left);

        var start = ContentRepository.Decks.FirstOrDefault(d => d.Key == deckKey)
                    ?? ContentRepository.Decks.FirstOrDefault(d => !ProgressStore.Data.VocabDecksDone.Contains(d.Key))
                    ?? ContentRepository.Decks.FirstOrDefault();
        if (start != null) ShowDeck(start);
        else _detail.Add(new InfoBox("Nenhum deck encontrado (Content/vocab_*.txt).", Theme.Ui(11f), Theme.Error, Theme.ErrorSoft));
    }

    private void RefreshButtons()
    {
        foreach (Control c in _decks.Controls)
        {
            if (c is not FlatButton b || b.Tag is not VocabDeck d) continue;
            bool done = ProgressStore.Data.VocabDecksDone.Contains(d.Key);
            b.Text = $"{d.Icon}   {(done ? "✓ " : "")}{d.Name}  ({d.Items.Count})";
            bool active = d == _current;
            b.BaseColor = active ? Theme.AccentSoft : Color.White;
            b.ForeColor = active ? Theme.AccentDark : done ? Theme.Success : Theme.Text;
            b.Invalidate();
        }
    }

    private void ShowDeck(VocabDeck deck)
    {
        _current = deck;
        RefreshButtons();
        _detail.SuspendLayout();
        foreach (Control c in _detail.Controls.Cast<Control>().ToList()) c.Dispose();
        _detail.Controls.Clear();

        _detail.Add(Ui.Label($"{deck.Icon}  {deck.Name}", Theme.Jp(17f, FontStyle.Bold), Theme.Accent));
        int inSrs = deck.Items.Count(v => ProgressStore.Data.Srs.ContainsKey(v.Key));
        bool done = ProgressStore.Data.VocabDecksDone.Contains(deck.Key);
        _detail.Add(Ui.Label($"{deck.Level}  ·  {deck.Items.Count} palavras  ·  {inSrs} na sua revisão{(done ? "  ·  ✓ deck concluído" : "")}",
            Theme.Ui(10.5f), Theme.Muted));

        var quiz = FlatButton.Primary("Quiz (20 questões)", (_, _) => StartQuiz(deck));
        quiz.Glyph = Glyphs.Play;
        quiz.FitWidth();
        var add = FlatButton.Secondary("Adicionar todas à revisão", null);
        add.Click += (_, _) =>
        {
            foreach (var v in deck.Items) ProgressStore.AddToSrs(v);
            ProgressStore.Save();
            ShowDeck(deck);
        };
        add.Enabled = inSrs < deck.Items.Count;
        var play = FlatButton.Secondary("Ouvir todas", (_, _) => Speech.SpeakQueue(deck.Items.Select(i => i.Jp)));
        play.Glyph = Glyphs.Volume;
        play.FitWidth();
        play.Enabled = Speech.Available;
        var speak = FlatButton.Secondary("Treinar fala", (_, _) => MainForm.Instance.ShowView(new SpeakingView("Deck: " + deck.Name, deck.Items), "speak"));
        speak.Glyph = "";
        speak.FitWidth();
        _detail.Add(Ui.Row(quiz, add, play, speak));
        _detail.Add(Ui.Label("Faça o quiz com 70% ou mais para concluir o deck — as palavras entram na revisão espaçada automaticamente. Clique numa palavra para ouvir.",
            Theme.Ui(9.5f), Theme.Muted));

        var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent };
        foreach (var v in deck.Items) flow.Controls.Add(new VocabTile(v));
        _detail.Add(flow);
        _detail.ResumeLayout(true);
        _detail.AutoScrollPosition = new Point(0, 0);
    }

    private static void StartQuiz(VocabDeck deck)
    {
        var pool = ContentRepository.Decks.SelectMany(d => d.Items).Concat(ContentRepository.AllVocab).ToList();
        MainForm.Instance.RunExercises("Deck: " + deck.Name, () =>
        {
            // prioriza palavras que ainda não estão na revisão ou que você erra
            var ordered = deck.Items
                .OrderByDescending(v => ProgressStore.Data.Mistakes.GetValueOrDefault(v.Key))
                .ThenBy(v => ProgressStore.Data.Srs.ContainsKey(v.Key) ? 1 : 0)
                .ThenBy(_ => Random.Shared.Next())
                .Take(20).ToList();
            return ExerciseFactory.Shuffle(ExerciseFactory.VocabDrill(ordered, ordered.Count, pool));
        }, r =>
        {
            int xp = r.Correct * 2;
            string msg = $"+{xp} XP";
            if (r.Percent >= 70)
            {
                if (ProgressStore.Data.VocabDecksDone.Add(deck.Key)) xp += 15;
                foreach (var v in deck.Items) ProgressStore.AddToSrs(v);
                msg = $"+{xp} XP · Deck concluído! As palavras entraram na sua revisão.";
            }
            ProgressStore.AddXp(xp);
            return msg;
        }, () => MainForm.Instance.ShowView(new VocabView(deck.Key), "vocab"), "vocab");
    }
}
