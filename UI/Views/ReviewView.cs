using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Revisão espaçada (SRS) estilo flashcards.</summary>
public class ReviewView : UserControl
{
    private readonly StackPanel _stack;
    private List<SrsItem> _queue = new();
    private int _pos;
    private bool _revealed;
    private bool _reverse;
    private int _reviewed, _correct;
    private SrsItem? _cur;
    private readonly HashSet<SrsItem> _lapsedInSession = new();

    public ReviewView()
    {
        BackColor = Theme.Background;
        _stack = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(36, 28, 36, 28), MaxContentWidth = Theme.S(820), Spacing = 12 };
        Controls.Add(_stack);
        ShowStart();
    }

    private void Clear()
    {
        _stack.SuspendLayout();
        foreach (Control c in _stack.Controls.Cast<Control>().ToList()) c.Dispose();
        _stack.Controls.Clear();
    }

    private void ShowStart()
    {
        Clear();
        _stack.Add(Ui.Title("Revisão espaçada (SRS)"));
        _stack.Add(Ui.Subtitle("O app mostra cada palavra pouco antes de você esquecê-la. Revisar todo dia é o segredo para memorizar milhares de palavras."));

        var all = ProgressStore.Data.Srs.Values.ToList();
        var due = ProgressStore.DueCount;
        if (all.Count == 0)
        {
            _stack.Add(new InfoBox("Sua revisão está vazia. Conclua lições (70%+) ou grupos de kanji para adicionar itens automaticamente. " +
                                   "Na tela de Frases úteis você também pode adicionar frases.", Theme.Ui(11.5f), Theme.Indigo, Theme.IndigoSoft));
            _stack.ResumeLayout(true);
            return;
        }

        var stats = new FlowLayoutPanel { AutoSize = true, BackColor = Color.Transparent };
        stats.Controls.Add(new StatTile("🔁", due.ToString(), "para revisar agora", Theme.Success));
        stats.Controls.Add(new StatTile("🌱", all.Count(s => s.Box <= 2).ToString(), "aprendendo", Theme.Warning));
        stats.Controls.Add(new StatTile("🌳", all.Count(s => s.Box > 5).ToString(), "maduros (30+ dias)", Theme.Indigo));
        stats.Controls.Add(new StatTile("📚", all.Count.ToString(), "itens no total", Theme.Accent));
        _stack.Add(stats);

        var startJp = FlatButton.Primary($"Revisar: japonês → português ({due})", (_, _) => StartSession(false));
        var startPt = FlatButton.Secondary($"Revisar: português → japonês ({due})", (_, _) => StartSession(true));
        startJp.Enabled = startPt.Enabled = due > 0;
        startJp.Height = startPt.Height = Theme.S(50);
        _stack.Add(Ui.Row(startJp, startPt));

        if (due == 0)
        {
            var next = all.Min(s => s.Due);
            _stack.Add(new InfoBox($"Nada pendente agora. 🎉 Próxima revisão: {next:dd/MM HH:mm}. Enquanto isso, faça um treino livre ou avance no curso.",
                Theme.Ui(11f), Theme.Success, Theme.SuccessSoft));
        }

        _stack.Add(Ui.Section("Treino livre"));
        _stack.Add(Ui.Subtitle("Exercícios de múltipla escolha, áudio e escrita com itens aleatórios da sua coleção (não altera o agendamento)."));
        var practice = FlatButton.Secondary("Treino livre (20 questões)", (_, _) => StartPractice());
        practice.Glyph = Glyphs.Play;
        practice.FitWidth();
        practice.Tag = "fixed";
        _stack.Add(practice);

        _stack.Add(new InfoBox("Como avaliar cada cartão:\n" +
                               "• Errei — não lembrei: volta em alguns minutos.\n" +
                               "• Difícil — lembrei com esforço: intervalo curto.\n" +
                               "• Bom — lembrei normalmente: intervalo aumenta.\n" +
                               "• Fácil — sabia de cara: intervalo aumenta bastante.\n" +
                               "Atalhos: Espaço = mostrar resposta · 1, 2, 3, 4 = avaliar.",
            Theme.Ui(10.5f), Theme.Text, Color.White) { BorderColor = Theme.Border });
        _stack.ResumeLayout(true);
    }

    internal void StartSession(bool reverse)
    {
        _reverse = reverse;
        _queue = ExerciseFactory.Shuffle(ProgressStore.DueItems().Take(ProgressStore.Data.Settings.MaxReviewsPerSession));
        _pos = 0;
        _reviewed = 0;
        _correct = 0;
        _lapsedInSession.Clear();
        ShowCard();
    }

    private void ShowCard()
    {
        if (_pos >= _queue.Count)
        {
            Finish();
            return;
        }
        _cur = _queue[_pos];
        _revealed = false;
        Clear();
        var top = Ui.Row(
            FlatButton.Icon(Glyphs.Close, "Encerrar revisão", (_, _) => Finish()),
            Ui.Label($"Restam {_queue.Count - _pos}  ·  {KindName(_cur.Kind)}", Theme.UiSemi(11f), Theme.Muted, new Padding(0, Theme.S(10), 0, 0)));
        _stack.Add(top);
        _stack.Add(new ProgressLine { Value = (float)_pos / _queue.Count });

        bool showJp = !_reverse;
        var front = showJp
            ? new JpBlock(_cur.Front, _cur.Kind == "kanji" ? 72f : _cur.Front.Length > 12 ? 22f : 34f, null, null,
                _cur.Kind == "kanji" ? null : () => Speech.Speak(_cur.Front), () => Speech.Speak(_cur.Front, true))
            : (Control)new InfoBox(_cur.Back, Theme.Ui(20f, FontStyle.Bold), Theme.Text, Color.White) { BorderColor = Theme.Border, Inner = new Padding(22, 26, 22, 26) };
        _stack.Add(front);
        _stack.Add(Ui.Label(showJp ? "Você lembra o significado e a leitura?" : "Como se diz isso em japonês? Fale em voz alta antes de virar.",
            Theme.Ui(11f), Theme.Muted));

        var reveal = FlatButton.Primary("Mostrar resposta (Espaço)", (_, _) => Reveal());
        reveal.Height = Theme.S(52);
        reveal.Font = Theme.UiSemi(12f);
        reveal.FitWidth(Theme.S(280));
        reveal.Height = Theme.S(52);
        reveal.Tag = "fixed";
        _stack.Add(reveal);
        _stack.ResumeLayout(true);
        _stack.PerformLayout();
        if (showJp && _cur.Kind != "kanji" && ProgressStore.Data.Settings.AutoPlayAudio) Speech.Speak(_cur.Front);
        Focus();
    }

    private static string KindName(string k) => k switch { "kanji" => "kanji", "frase" => "frase", _ => "vocabulário" };

    private void Reveal()
    {
        if (_cur == null || _revealed) return;
        _revealed = true;
        _stack.SuspendLayout();
        // remove o botão de revelar
        var last = _stack.Controls[_stack.Controls.Count - 1];
        _stack.Controls.Remove(last);
        last.Dispose();

        var reading = _cur.Reading;
        var lines = new List<string>();
        if (_reverse) lines.Add(_cur.Front);
        if (!string.IsNullOrWhiteSpace(reading) && reading != _cur.Front) lines.Add(reading);
        if (ProgressStore.Data.Settings.ShowRomaji && _cur.Kind != "kanji" && Kana.IsAllKana(reading.Replace(" ", ""))) lines.Add(Kana.ToRomaji(reading));
        if (!_reverse) lines.Add(_cur.Back);
        if (!string.IsNullOrWhiteSpace(_cur.Extra)) lines.Add(_cur.Extra);
        _stack.Add(new InfoBox(string.Join("\n", lines), Theme.Jp(15f), Theme.Indigo, Theme.IndigoSoft));
        if (_cur.Kind != "kanji" && Speech.Available) Speech.Speak(_cur.Front);

        var row = new FlowLayoutPanel { AutoSize = true, BackColor = Color.Transparent };
        string[] names = { "Errei", "Difícil", "Bom", "Fácil" };
        Color[] colors = { Theme.Error, Theme.Warning, Theme.Success, Theme.Indigo };
        for (int g = 0; g < 4; g++)
        {
            int grade = g;
            var b = FlatButton.Primary($"{g + 1}. {names[g]}", (_, _) => Grade(grade));
            b.SubText = NextIntervalText(_cur, g);
            b.BaseColor = colors[g];
            b.HoverColor = Theme.Blend(colors[g], Color.Black, 0.15f);
            b.Size = new Size(Theme.S(150), Theme.S(62));
            b.Margin = new Padding(0, 0, Theme.S(10), 0);
            row.Controls.Add(b);
        }
        _stack.Add(row);
        _stack.ResumeLayout(true);
        _stack.PerformLayout();
    }

    private static string NextIntervalText(SrsItem item, int grade)
    {
        if (grade == 0) return "agora";
        int box = grade switch
        {
            1 => Math.Max(1, item.Box),
            2 => Math.Min(ProgressStore.Intervals.Length - 1, item.Box + 1),
            _ => Math.Min(ProgressStore.Intervals.Length - 1, item.Box + 2)
        };
        int days = ProgressStore.Intervals[box];
        if (grade == 1) days = Math.Max(1, days / 2);
        days = Math.Max(1, days);
        return days == 1 ? "1 dia" : days < 30 ? $"{days} dias" : $"{days / 30} mês(es)";
    }

    private void Grade(int grade)
    {
        if (_cur == null || !_revealed) return;
        ProgressStore.Grade(_cur, grade);
        _reviewed++;
        if (grade > 0 && !_lapsedInSession.Contains(_cur)) _correct++;
        if (grade == 0)
        {
            ProgressStore.RecordMistake(_cur.Key);
            _lapsedInSession.Add(_cur);
            _queue.Add(_cur); // revê no fim da sessão
        }
        _pos++;
        ProgressStore.Save();
        ShowCard();
    }

    private void Finish()
    {
        Speech.Stop();
        _cur = null;
        _queue = new List<SrsItem>();
        _pos = 0;
        int xp = _reviewed;
        ProgressStore.AddXp(xp);
        ProgressStore.Save();
        Clear();
        var t = Ui.Label("おつかれさまでした！", Theme.Jp(26f, FontStyle.Bold), Theme.Success);
        t.Tag = "center";
        _stack.Add(t);
        var s = Ui.Label($"{_reviewed} cartões revisados · +{xp} XP", Theme.Ui(14f), Theme.Text);
        s.Tag = "center";
        _stack.Add(s);
        var back = FlatButton.Primary("Voltar", (_, _) => ShowStart());
        back.Tag = "center";
        _stack.Add(back);
        _stack.ResumeLayout(true);
    }

    private void StartPractice()
    {
        var items = ProgressStore.Data.Srs.Values.Where(s => s.Kind != "kanji")
            .Select(s => new VocabItem(s.Front, s.Reading, s.Back, "srs")).ToList();
        var kanji = ProgressStore.Data.Srs.Values.Where(s => s.Kind == "kanji")
            .Select(s => ContentRepository.Kanji.FirstOrDefault(k => k.Char == s.Front)).Where(k => k != null).Cast<KanjiEntry>().ToList();
        MainForm.Instance.RunExercises("Treino livre", () =>
        {
            var list = new List<Exercise>();
            if (items.Count >= 2) list.AddRange(ExerciseFactory.VocabDrill(items, Math.Min(16, items.Count), ContentRepository.AllVocab.ToList()));
            if (kanji.Count >= 2) list.AddRange(ExerciseFactory.KanjiDrill(ExerciseFactory.Shuffle(kanji).Take(4).ToList()).Take(6));
            return ExerciseFactory.Shuffle(list).Take(20).ToList();
        }, r =>
        {
            ProgressStore.AddXp(r.Correct);
            return $"+{r.Correct} XP";
        }, () => MainForm.Instance.Navigate("review"), "review");
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (_cur != null && _pos < _queue.Count)
        {
            if (keyData == Keys.Space && !_revealed) { Reveal(); return true; }
            if (_revealed)
            {
                int g = keyData switch { Keys.D1 or Keys.NumPad1 => 0, Keys.D2 or Keys.NumPad2 => 1, Keys.D3 or Keys.NumPad3 => 2, Keys.D4 or Keys.NumPad4 => 3, _ => -1 };
                if (g >= 0) { Grade(g); return true; }
            }
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}
