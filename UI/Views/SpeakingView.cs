using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Treino de fala: ouvir o modelo, gravar a própria voz, comparar e conferir a pronúncia.</summary>
public class SpeakingView : UserControl
{
    private record Source(string Name, List<VocabItem> Items)
    {
        public override string ToString() => $"{Name} ({Items.Count})";
    }

    private readonly StackPanel _stack;
    private readonly List<Source> _sources = new();
    private Source _source;
    private int _index;
    private InfoBox? _result;
    private FlatButton? _recordBtn;
    private bool _busy;

    public SpeakingView(string? title = null, List<VocabItem>? items = null)
    {
        BackColor = Theme.Background;
        _stack = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(36, 24, 36, 24), MaxContentWidth = Theme.S(860), Spacing = 10 };
        Controls.Add(_stack);

        if (items != null && items.Count > 0) _sources.Add(new Source(title ?? "Selecionados", items));
        foreach (var m in ContentRepository.Modules)
        {
            var list = m.Lessons.SelectMany(l => l.Examples.Where(e => e.Length >= 3).Select(e => new VocabItem(e[0], e[1], e[2], l.Id))
                    .Concat(l.Dialog.Where(d => d.Length >= 4).Select(d => new VocabItem(d[1], d[2], d[3], l.Id))))
                .DistinctBy(v => v.Jp).ToList();
            if (list.Count > 0) _sources.Add(new Source("Frases de " + m.Title, list));
        }
        foreach (var c in ContentRepository.Phrases)
            _sources.Add(new Source("Frases úteis: " + c.Name, c.Items.ToList()));
        _source = _sources.FirstOrDefault() ?? new Source("vazio", new List<VocabItem>());
        Build();
        Disposed += (_, _) => { if (SpeechPractice.IsRecording) SpeechPractice.StopRecording(); SpeechPractice.StopPlayback(); };
    }

    private VocabItem? Current => _source.Items.Count == 0 ? null : _source.Items[Math.Clamp(_index, 0, _source.Items.Count - 1)];

    private void Build()
    {
        _stack.SuspendLayout();
        foreach (Control c in _stack.Controls.Cast<Control>().ToList()) c.Dispose();
        _stack.Controls.Clear();
        _result = null;

        _stack.Add(Ui.Title("Treino de fala"));
        _stack.Add(Ui.Subtitle("Shadowing: ouça o modelo, repita em voz alta, grave e compare. Falar é o que destrava a conversa no Japão."));

        // fonte + navegação
        var combo = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = Theme.S(420), Font = Theme.Ui(10.5f) };
        foreach (var s in _sources) combo.Items.Add(s);
        combo.SelectedItem = _source;
        combo.SelectedIndexChanged += (_, _) =>
        {
            if (combo.SelectedItem is Source s && s != _source)
            {
                _source = s;
                _index = 0;
                BeginInvoke(Build);
            }
        };
        var counter = Ui.Label(_source.Items.Count == 0 ? "" : $"{_index + 1} / {_source.Items.Count}", Theme.UiSemi(11f), Theme.Muted, new Padding(Theme.S(6), Theme.S(8), 0, 0));
        _stack.Add(Ui.Row(combo,
            FlatButton.Icon(Glyphs.Back, "Anterior (←)", (_, _) => Step(-1)),
            FlatButton.Icon(Glyphs.Forward, "Próxima (→)", (_, _) => Step(1)),
            FlatButton.Secondary("Aleatória", (_, _) => { _index = Random.Shared.Next(_source.Items.Count); Build(); }),
            counter));

        var cur = Current;
        if (cur == null)
        {
            _stack.Add(new InfoBox("Nenhuma frase nesta fonte.", Theme.Ui(11f), Theme.Muted, Color.White));
            _stack.ResumeLayout(true);
            return;
        }

        string? reading = cur.HasKanji && ProgressStore.Data.Settings.ShowReading ? cur.Reading.Replace(" ", "") : null;
        string? romaji = ProgressStore.Data.Settings.ShowRomaji ? Kana.ToRomaji(cur.Reading) : null;
        _stack.Add(new JpBlock(cur.Jp, cur.Jp.Length > 18 ? 20f : 26f, reading, romaji, () => Speech.Speak(cur.Jp), () => Speech.Speak(cur.Jp, true)));
        _stack.Add(new InfoBox(cur.Meaning, Theme.Ui(12f), Theme.Indigo, Theme.IndigoSoft));

        if (ProgressStore.Data.SpeakingBest.TryGetValue(cur.Key, out var best))
            _stack.Add(Ui.Label($"Sua melhor nota nesta frase: {best}%", Theme.UiSemi(10f), best >= 80 ? Theme.Success : Theme.Warning));

        // ações
        var listen = MakeButton("Ouvir", Glyphs.Volume, Theme.Indigo, (_, _) => Speech.Speak(cur.Jp));
        var slow = MakeButton("Devagar", Glyphs.Volume, Theme.Indigo, (_, _) => Speech.Speak(cur.Jp, true));
        listen.Enabled = slow.Enabled = Speech.Available;
        _recordBtn = MakeButton(SpeechPractice.IsRecording ? "Parar" : "Gravar", "", Theme.Accent, (_, _) => ToggleRecord());
        _recordBtn.Enabled = SpeechPractice.HasMicrophone;
        var mine = MakeButton("Minha voz", Glyphs.Play, Theme.Success, async (_, _) => await SpeechPractice.PlayRecordingAsync());
        mine.Enabled = SpeechPractice.HasRecording;
        var compare = MakeButton("Comparar", "", Theme.Success, async (_, _) => await Compare(cur));
        compare.Enabled = SpeechPractice.HasRecording && Speech.Available;
        var check = MakeButton("Verificar pronúncia", "", Theme.Warning, async (_, _) => await Check(cur));
        check.Enabled = SpeechPractice.JapaneseRecognitionAvailable && SpeechPractice.HasMicrophone;
        _stack.Add(Ui.Row(listen, slow, _recordBtn, mine, compare, check));

        _result = new InfoBox("", Theme.Jp(11f), Theme.Text, Color.White) { BorderColor = Theme.Border, Visible = false };
        _stack.Add(_result);

        // avisos de disponibilidade
        var warnings = new List<string>();
        if (!Speech.Available) warnings.Add("• Sem voz japonesa: não dá para ouvir o modelo. Instale em Configurações → Diagnóstico de áudio.");
        if (!SpeechPractice.HasMicrophone) warnings.Add("• Nenhum microfone encontrado: gravação e verificação desativadas.");
        else if (!SpeechPractice.JapaneseRecognitionAvailable) warnings.Add("• \"Verificar pronúncia\" precisa do reconhecimento de fala japonês do Windows (mesmo pacote da voz, marque \"Reconhecimento de fala\"). Gravar e comparar já funcionam.");
        if (warnings.Count > 0)
            _stack.Add(new InfoBox(string.Join("\n", warnings), Theme.Ui(10f), Theme.AccentDark, Theme.ErrorSoft));

        _stack.Add(new InfoBox(
            "Como treinar (5 minutos por dia já fazem diferença):\n" +
            "1. Ouça a frase 2–3 vezes, primeiro devagar, prestando atenção na melodia.\n" +
            "2. Repita junto com o áudio (shadowing), imitando ritmo e entonação — não só as sílabas.\n" +
            "3. Grave sozinho e use \"Comparar\": o app toca o modelo e logo depois a sua voz.\n" +
            "4. Use \"Verificar pronúncia\" para ver se o Windows entende o que você disse.\n" +
            "Atenção às vogais longas (おばさん × おばあさん) e ao っ (きて × きって): é onde brasileiros mais erram.",
            Theme.Jp(10f), Theme.Text, Color.White) { BorderColor = Theme.Border });

        _stack.ResumeLayout(true);
        _stack.PerformLayout();
    }

    private static FlatButton MakeButton(string text, string glyph, Color color, EventHandler click)
    {
        var b = FlatButton.Primary(text, click);
        b.Glyph = glyph;
        b.BaseColor = color;
        b.HoverColor = Theme.Blend(color, Color.Black, 0.15f);
        b.FitWidth();
        b.Height = Theme.S(46);
        return b;
    }

    private void Step(int delta)
    {
        if (_source.Items.Count == 0) return;
        if (SpeechPractice.IsRecording) SpeechPractice.StopRecording();
        _index = (_index + delta + _source.Items.Count) % _source.Items.Count;
        Build();
    }

    private void ShowResult(string text, Color fore, Color back)
    {
        if (_result == null) return;
        _result.Text = text;
        _result.ForeColor = fore;
        _result.FillColor = back;
        _result.Visible = true;
        _result.Invalidate();
        _stack.PerformLayout();
    }

    private void ToggleRecord()
    {
        if (!SpeechPractice.IsRecording)
        {
            Speech.Stop();
            var err = SpeechPractice.StartRecording();
            if (err != "")
            {
                ShowResult("Não consegui gravar: " + err, Theme.AccentDark, Theme.ErrorSoft);
                return;
            }
            _recordBtn!.Text = "Parar";
            _recordBtn.FitWidth();
            ShowResult("🎙 Gravando... fale a frase e clique em \"Parar\".", Theme.Accent, Theme.AccentSoft);
            _stack.PerformLayout();
        }
        else
        {
            var err = SpeechPractice.StopRecording();
            if (err != "") ShowResult("Erro ao salvar a gravação: " + err, Theme.AccentDark, Theme.ErrorSoft);
            Build();
            if (err == "") ShowResult("Gravação salva. Clique em \"Minha voz\" ou \"Comparar\".", Theme.Success, Theme.SuccessSoft);
        }
    }

    private async Task Compare(VocabItem cur)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            ShowResult("▶ Modelo...", Theme.Indigo, Theme.IndigoSoft);
            await Speech.SpeakAndWaitAsync(cur.Jp);
            await Task.Delay(350);
            ShowResult("▶ Sua voz...", Theme.Success, Theme.SuccessSoft);
            await SpeechPractice.PlayRecordingAsync();
            ShowResult("O ritmo e a melodia ficaram parecidos? Se não, ouça de novo e repita.", Theme.Text, Color.White);
        }
        finally
        {
            _busy = false;
        }
    }

    private async Task Check(VocabItem cur)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            Speech.Stop();
            ShowResult("🎙 Fale a frase agora...", Theme.Accent, Theme.AccentSoft);
            var o = await SpeechPractice.RecognizeAsync(cur.Jp, cur.Reading);
            if (IsDisposed) return;
            if (!o.Ok)
            {
                ShowResult(o.Message, Theme.AccentDark, Theme.ErrorSoft);
                return;
            }
            int pct = (int)Math.Round(o.Score * 100);
            var prev = ProgressStore.Data.SpeakingBest.GetValueOrDefault(cur.Key);
            if (pct > prev) ProgressStore.Data.SpeakingBest[cur.Key] = pct;
            if (pct >= 70) ProgressStore.AddXp(2);
            ProgressStore.Save();

            string verdict = pct >= 90 ? "Excelente! すばらしい！" :
                             pct >= 70 ? "Muito bem! Deu para entender." :
                             pct >= 45 ? "Quase — ouça o modelo devagar e tente de novo." :
                             "Não reconheci bem. Fale mais devagar e claramente.";
            var lines = new List<string> { $"{verdict}  ({pct}%)" };
            if (!string.IsNullOrWhiteSpace(o.Heard)) lines.Add("O Windows entendeu: " + o.Heard);
            lines.Add("Esperado: " + cur.Jp);
            if (o.Message != "") lines.Add(o.Message);
            ShowResult(string.Join("\n", lines),
                pct >= 70 ? Theme.Success : pct >= 45 ? Color.FromArgb(110, 75, 0) : Theme.AccentDark,
                pct >= 70 ? Theme.SuccessSoft : pct >= 45 ? Theme.WarningSoft : Theme.ErrorSoft);
        }
        finally
        {
            _busy = false;
        }
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (ActiveControl is ComboBox) return base.ProcessCmdKey(ref msg, keyData);
        switch (keyData)
        {
            case Keys.Left: Step(-1); return true;
            case Keys.Right: Step(1); return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}
