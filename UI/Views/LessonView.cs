using JapHelp.Core;

namespace JapHelp.UI.Views;

public class LessonView : UserControl
{
    private readonly Lesson _lesson;
    private readonly Panel _content;
    private readonly List<(string key, FlatButton btn)> _tabs = new();
    private readonly Color _color;

    public LessonView(Lesson lesson, string initialTab = "theory")
    {
        _lesson = lesson;
        _color = Theme.FromHex(lesson.Module.Color, Theme.Accent);
        BackColor = Theme.Background;

        // ---- cabeçalho
        var header = new Panel { Dock = DockStyle.Top, Height = Theme.S(104), BackColor = Theme.Background, Padding = Theme.Pad(28, 18, 28, 0) };
        var back = FlatButton.Icon(Glyphs.Back, "Voltar ao curso", (_, _) => MainForm.Instance.Navigate("course"));
        back.Location = new Point(Theme.S(28), Theme.S(22));
        var mod = Ui.Label($"{lesson.Module.Title}  ·  Lição {lesson.Index + 1} de {lesson.Module.Lessons.Count}", Theme.Ui(9.5f, FontStyle.Bold), _color);
        mod.Location = new Point(Theme.S(82), Theme.S(16));
        var title = Ui.Label(lesson.Title, Theme.Ui(19f, FontStyle.Bold), Theme.Text);
        title.Location = new Point(Theme.S(80), Theme.S(34));
        var sub = Ui.Label(lesson.Subtitle, Theme.Jp(10.5f), Theme.Muted);
        sub.Location = new Point(Theme.S(82), Theme.S(72));
        header.Controls.AddRange(new Control[] { back, mod, title, sub });

        var nextLesson = ContentRepository.NextLesson(lesson);
        if (nextLesson != null)
        {
            var nextBtn = FlatButton.Secondary("Próxima lição", (_, _) => MainForm.Instance.OpenLesson(nextLesson));
            nextBtn.Glyph = Glyphs.Forward;
            nextBtn.FitWidth();
            nextBtn.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            header.Controls.Add(nextBtn);
            header.Resize += (_, _) => nextBtn.Location = new Point(header.Width - nextBtn.Width - Theme.S(28), Theme.S(22));
        }

        // ---- abas
        var tabs = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Theme.S(56), BackColor = Theme.Background, Padding = Theme.Pad(28, 8, 28, 4), WrapContents = false };
        AddTab(tabs, "theory", "📖  Teoria");
        if (lesson.Vocab.Count > 0 || !string.IsNullOrWhiteSpace(lesson.Kana)) AddTab(tabs, "vocab", $"🈁  Vocabulário ({lesson.Vocab.Count})");
        if (lesson.Examples.Count > 0) AddTab(tabs, "examples", $"💬  Exemplos ({lesson.Examples.Count})");
        if (lesson.Dialog.Count > 0) AddTab(tabs, "dialog", "🎭  Diálogo");
        AddTab(tabs, "exercises", "✏️  Exercícios");

        _content = new Panel { Dock = DockStyle.Fill, BackColor = Theme.Background, Padding = Theme.Pad(28, 8, 28, 20) };

        Controls.Add(_content);
        Controls.Add(tabs);
        Controls.Add(header);

        ShowTab(_tabs.Any(t => t.key == initialTab) ? initialTab : "theory");
    }

    private void AddTab(FlowLayoutPanel host, string key, string text)
    {
        var b = FlatButton.Secondary(text, (_, _) => ShowTab(key));
        b.Font = Theme.UiSemi(10.5f);
        b.FitWidth();
        b.Margin = new Padding(0, 0, Theme.S(8), 0);
        _tabs.Add((key, b));
        host.Controls.Add(b);
    }

    private void ShowTab(string key)
    {
        foreach (var (k, b) in _tabs)
        {
            bool active = k == key;
            b.BaseColor = active ? _color : Color.White;
            b.HoverColor = active ? Theme.Blend(_color, Color.Black, 0.1f) : Theme.IndigoSoft;
            b.ForeColor = active ? Color.White : Theme.Text;
            b.BorderColor = active ? Color.Empty : Theme.Border;
            b.Invalidate();
        }
        Speech.Stop();
        SuspendLayout();
        foreach (Control c in _content.Controls.Cast<Control>().ToList()) c.Dispose();
        _content.Controls.Clear();
        Control view = key switch
        {
            "vocab" => BuildVocab(),
            "examples" => BuildExamples(),
            "dialog" => BuildDialog(),
            "exercises" => BuildExercises(),
            _ => BuildTheory(),
        };
        view.Dock = DockStyle.Fill;
        _content.Controls.Add(view);
        ResumeLayout(true);
    }

    // ---------------- Teoria ----------------
    private Control BuildTheory()
    {
        var card = new CardPanel { Padding = Theme.Pad(24, 18, 12, 12) };
        var rtb = TheoryRenderer.Create();
        card.Controls.Add(rtb);
        var bar = new Panel { Dock = DockStyle.Bottom, Height = Theme.S(54), BackColor = Color.White };
        var nextKey = _tabs.Count > 1 ? _tabs[1].key : "exercises";
        var next = FlatButton.Primary("Continuar  →", (_, _) => ShowTab(nextKey));
        next.BaseColor = _color;
        next.HoverColor = Theme.Blend(_color, Color.Black, 0.12f);
        next.Anchor = AnchorStyles.Right | AnchorStyles.Bottom;
        bar.Controls.Add(next);
        bar.Resize += (_, _) => next.Location = new Point(bar.Width - next.Width - Theme.S(12), Theme.S(6));
        card.Controls.Add(bar);
        TheoryRenderer.Attach(rtb, _lesson.Theory);

        var lp = ProgressStore.GetLesson(_lesson.Id);
        if (!lp.TheoryRead)
        {
            lp.TheoryRead = true;
            ProgressStore.Save();
        }
        return card;
    }

    // ---------------- Vocabulário ----------------
    private Control BuildVocab()
    {
        var stack = new StackPanel { Padding = Theme.Pad(0, 4, 8, 8), Spacing = 8 };

        if (!string.IsNullOrWhiteSpace(_lesson.Kana))
        {
            var units = Kana.SplitUnits(_lesson.Kana!);
            stack.Add(Ui.Section("Kana desta lição"));
            stack.Add(Ui.Subtitle("Clique para ouvir · duplo clique para praticar a escrita (traçado)."));
            var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent };
            foreach (var u in units)
            {
                var tile = new CharTile(u, Kana.ToRomaji(u), 76) { CharSize = 26f };
                tile.Click += (_, _) => Speech.Speak(u);
                tile.DoubleClick += (_, _) => TracingForm.Open(units, units.IndexOf(u));
                flow.Controls.Add(tile);
            }
            stack.Add(flow);
            var traceBtn = FlatButton.Secondary("Praticar escrita destes kana", (_, _) => TracingForm.Open(units, 0));
            traceBtn.Glyph = Glyphs.Pen;
            traceBtn.FitWidth();
            traceBtn.Tag = "fixed";
            stack.Add(traceBtn);
        }

        var items = _lesson.VocabItems.ToList();
        if (items.Count > 0)
        {
            stack.Add(Ui.Section("Palavras"));
            var playAll = FlatButton.Secondary("Ouvir todas", (_, _) => Speech.SpeakQueue(items.Select(i => i.Jp)));
            playAll.Glyph = Glyphs.Play;
            playAll.FitWidth();
            playAll.Enabled = Speech.Available;
            stack.Add(Ui.Row(playAll, Ui.Label("Clique numa palavra para ouvir (clique direito = devagar).", Theme.Ui(10f), Theme.Muted)));
            var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent };
            foreach (var v in items)
                flow.Controls.Add(new VocabTile(v) { AccentColor = _color });
            stack.Add(flow);
        }
        return stack;
    }

    // ---------------- Exemplos ----------------
    private Control BuildExamples()
    {
        var stack = new StackPanel { Padding = Theme.Pad(0, 4, 8, 8), Spacing = 8 };
        stack.Add(Ui.Subtitle("Leia em voz alta junto com o áudio (shadowing). Clique no cartão para ouvir; clique direito = devagar."));
        foreach (var ex in _lesson.Examples.Where(e => e.Length >= 3))
            stack.Add(new SentenceCard(ex[0], ex[1], ex[2]));
        return stack;
    }

    // ---------------- Diálogo ----------------
    private Control BuildDialog()
    {
        var stack = new StackPanel { Padding = Theme.Pad(0, 4, 8, 8), Spacing = 8 };
        var lines = _lesson.Dialog.Where(d => d.Length >= 4).ToList();
        var play = FlatButton.Primary("Ouvir o diálogo inteiro", (_, _) => Speech.SpeakQueue(lines.Select(l => l[1])));
        play.Glyph = Glyphs.Play;
        play.FitWidth();
        play.Enabled = Speech.Available;
        play.BaseColor = _color;
        play.Tag = "fixed";
        stack.Add(play);
        stack.Add(Ui.Subtitle("Dica: depois de entender, cubra a tradução e tente fazer o papel de uma das pessoas."));
        var speakers = lines.Select(l => l[0]).Distinct().ToList();
        Color[] palette = { Theme.Indigo, Theme.Accent, Theme.Success, Theme.Warning };
        foreach (var l in lines)
        {
            stack.Add(new SentenceCard(l[1], l[2], l[3])
            {
                Speaker = l[0],
                SpeakerColor = palette[speakers.IndexOf(l[0]) % palette.Length],
            });
        }
        return stack;
    }

    // ---------------- Exercícios ----------------
    private Control BuildExercises()
    {
        var stack = new StackPanel { Padding = Theme.Pad(0, 4, 8, 8), Spacing = 12, MaxContentWidth = Theme.S(820) };
        var lp = ProgressStore.Data.Lessons.GetValueOrDefault(_lesson.Id);
        int authored = _lesson.Exercises.Count;
        stack.Add(Ui.Label("Hora de praticar!", Theme.Ui(18f, FontStyle.Bold), Theme.Text));
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(_lesson.Kana)) parts.Add("leitura e reconhecimento de kana");
        if (_lesson.Vocab.Count > 0) parts.Add("vocabulário (significado, áudio e escrita)");
        if (authored > 0) parts.Add($"{authored} exercícios de gramática e situações reais");
        stack.Add(Ui.Label("Esta sessão mistura " + string.Join(", ", parts) + ". Questões erradas voltam no final para você fixar.", Theme.Ui(11f), Theme.Muted));

        if (lp != null && lp.Attempts > 0)
            stack.Add(new InfoBox(lp.Completed ? $"✓ Lição concluída. Melhor resultado: {lp.BestScore}% em {lp.Attempts} tentativa(s)." :
                $"Melhor resultado até agora: {lp.BestScore}% — faça 70% para concluir.", Theme.UiSemi(11f),
                lp.Completed ? Theme.Success : Theme.Warning, lp.Completed ? Theme.SuccessSoft : Theme.WarningSoft));

        var start = FlatButton.Primary("Começar exercícios", (_, _) => StartExercises());
        start.Font = Theme.UiSemi(13f);
        start.Glyph = Glyphs.Play;
        start.FitWidth(Theme.S(260));
        start.Height = Theme.S(56);
        start.BaseColor = _color;
        start.HoverColor = Theme.Blend(_color, Color.Black, 0.12f);
        start.Tag = "fixed";
        stack.Add(start);

        stack.Add(new InfoBox("Como os exercícios funcionam:\n" +
            "• Múltipla escolha: clique ou use as teclas 1–4, depois Enter.\n" +
            "• Digitar: escreva em romaji (ex.: \"taberu\") e o app converte para かな. Se tiver teclado japonês (IME), pode digitar direto.\n" +
            "• Montar frase: clique nas peças na ordem certa — ótimo para treinar a ordem das palavras do japonês.\n" +
            "• Ouvir: escute (ou ouça devagar) e escolha o que ouviu.",
            Theme.Ui(10.5f), Theme.Text, Color.White) { BorderColor = Theme.Border });
        return stack;
    }

    private void StartExercises()
    {
        var lesson = _lesson;
        MainForm.Instance.RunExercises(lesson.Title, () => ExerciseFactory.ForLesson(lesson), r =>
        {
            var lp = ProgressStore.GetLesson(lesson.Id);
            bool wasCompleted = lp.Completed;
            lp.Attempts++;
            lp.LastDate = DateTime.Now;
            lp.BestScore = Math.Max(lp.BestScore, r.Percent);
            int xp = r.Correct * 2;
            string msg;
            if (r.Percent >= 70)
            {
                lp.Completed = true;
                xp += wasCompleted ? 5 : 25;
                foreach (var v in lesson.VocabItems) ProgressStore.AddToSrs(v);
                msg = wasCompleted ? $"+{xp} XP" : $"Lição concluída! +{xp} XP · O vocabulário entrou na sua revisão (SRS).";
            }
            else
            {
                msg = $"+{xp} XP · Faça 70% ou mais para concluir a lição.";
            }
            ProgressStore.AddXp(xp);
            return msg;
        }, () => MainForm.Instance.OpenLesson(lesson, "exercises"), "course");
    }
}
