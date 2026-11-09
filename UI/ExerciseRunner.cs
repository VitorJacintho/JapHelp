using JapHelp.Core;

namespace JapHelp.UI;

public record RunResult(int Correct, int Total, int Percent, List<Exercise> Mistakes);

/// <summary>Executa uma sequência de exercícios (estilo "uma pergunta por tela").</summary>
public class ExerciseRunner : UserControl
{
    private readonly string _title;
    private readonly Func<List<Exercise>> _generator;
    private readonly Func<RunResult, string?>? _onComplete;
    private readonly Action _onExit;

    private List<Exercise> _queue = new();
    private int _pos;
    private int _originalCount;
    private readonly HashSet<Exercise> _failed = new();
    private readonly HashSet<Exercise> _retried = new();
    private int _firstTryCorrect;
    private bool _answered;

    // UI
    private readonly Panel _top;
    private readonly ProgressLine _progress;
    private readonly Label _counter;
    private readonly StackPanel _body;
    private readonly Panel _bottom;
    private readonly Label _fbTitle;
    private readonly Label _fbText;
    private readonly FlatButton _mainBtn;
    private readonly FlatButton _fbSpeak;

    // estado por exercício
    private Exercise _cur = null!;
    private readonly List<FlatButton> _optionButtons = new();
    private int _selected = -1;
    private TextBox? _input;
    private Label? _preview;
    private FlowLayoutPanel? _answerArea;
    private FlowLayoutPanel? _bankArea;

    public ExerciseRunner(string title, Func<List<Exercise>> generator, Func<RunResult, string?>? onComplete, Action onExit)
    {
        _title = title;
        _generator = generator;
        _onComplete = onComplete;
        _onExit = onExit;
        BackColor = Theme.Background;
        Dock = DockStyle.Fill;

        // ---- topo
        _top = new Panel { Dock = DockStyle.Top, Height = Theme.S(64), BackColor = Theme.Background, Padding = Theme.Pad(20, 14, 20, 8) };
        var close = FlatButton.Icon(Glyphs.Close, "Sair", (_, _) => ConfirmExit());
        close.Dock = DockStyle.Left;
        _counter = new Label { Dock = DockStyle.Right, Width = Theme.S(90), TextAlign = ContentAlignment.MiddleRight, Font = Theme.UiSemi(11f), ForeColor = Theme.Muted };
        var progHost = new Panel { Dock = DockStyle.Fill, Padding = Theme.Pad(16, 14, 16, 14) };
        _progress = new ProgressLine { Dock = DockStyle.Fill };
        progHost.Controls.Add(_progress);
        _top.Controls.Add(progHost);
        _top.Controls.Add(close);
        _top.Controls.Add(_counter);

        // ---- rodapé (feedback)
        _bottom = new Panel { Dock = DockStyle.Bottom, Height = Theme.S(124), BackColor = Color.White, Padding = Theme.Pad(28, 12, 28, 12) };
        _mainBtn = FlatButton.Primary("Verificar", (_, _) => MainAction());
        _mainBtn.Font = Theme.UiSemi(12f);
        _mainBtn.Size = new Size(Theme.S(170), Theme.S(50));
        _mainBtn.Anchor = AnchorStyles.Right | AnchorStyles.Top;
        _fbSpeak = FlatButton.Icon(Glyphs.Volume, "Ouvir a resposta", (_, _) => Speech.Speak(_cur.SpeakText));
        _fbSpeak.Visible = false;
        _fbTitle = new Label { AutoSize = false, Font = Theme.Ui(14f, FontStyle.Bold), Location = new Point(Theme.S(28), Theme.S(10)), Height = Theme.S(30), UseMnemonic = false };
        _fbText = new Label { AutoSize = false, Font = Theme.Jp(10.5f), Location = new Point(Theme.S(28), Theme.S(42)), UseMnemonic = false };
        _bottom.Controls.AddRange(new Control[] { _fbTitle, _fbText, _mainBtn, _fbSpeak });
        _bottom.Resize += (_, _) => LayoutBottom();
        _bottom.Paint += (_, e) =>
        {
            using var pen = new Pen(Theme.Border);
            e.Graphics.DrawLine(pen, 0, 0, _bottom.Width, 0);
        };

        // ---- corpo
        _body = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(28, 16, 28, 16), MaxContentWidth = Theme.S(820), BackColor = Theme.Background, Spacing = 12 };

        Controls.Add(_body);
        Controls.Add(_bottom);
        Controls.Add(_top);

        Start();
    }

    private void LayoutBottom()
    {
        _mainBtn.Location = new Point(_bottom.Width - _mainBtn.Width - Theme.S(28), (_bottom.Height - _mainBtn.Height) / 2);
        _fbSpeak.Location = new Point(_mainBtn.Left - _fbSpeak.Width - Theme.S(12), (_bottom.Height - _fbSpeak.Height) / 2);
        int textW = Math.Max(100, _fbSpeak.Left - Theme.S(40));
        _fbTitle.Width = textW;
        _fbText.Width = textW;
        _fbText.Height = _bottom.Height - _fbText.Top - Theme.S(6);
    }

    private void Start()
    {
        _queue = _generator();
        _originalCount = _queue.Count;
        _pos = 0;
        _failed.Clear();
        _retried.Clear();
        _firstTryCorrect = 0;
        if (_queue.Count == 0)
        {
            _body.Controls.Clear();
            _body.Add(Ui.Title("Nenhum exercício disponível."));
            _body.Add(FlatButton.Primary("Voltar", (_, _) => _onExit()));
            _bottom.Visible = false;
            return;
        }
        ShowExercise();
    }

    private void ConfirmExit()
    {
        if (_pos >= _queue.Count || _pos == 0 ||
            MessageBox.Show("Sair agora? O progresso desta sessão será perdido.", _title, MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
        {
            Speech.Stop();
            _onExit();
        }
    }

    // =========================================================
    private void ShowExercise()
    {
        _cur = _queue[_pos];
        _answered = false;
        _selected = -1;
        _optionButtons.Clear();
        _input = null;
        _preview = null;
        _answerArea = null;
        _bankArea = null;

        _progress.Value = (float)_pos / Math.Max(1, _queue.Count);
        _counter.Text = $"{Math.Min(_pos + 1, _queue.Count)} / {_queue.Count}";

        _body.SuspendLayout();
        foreach (Control c in _body.Controls.Cast<Control>().ToList()) c.Dispose();
        _body.Controls.Clear();
        _body.AutoScrollPosition = new Point(0, 0);

        _bottom.Visible = true;
        _bottom.BackColor = Color.White;
        _fbTitle.Text = "";
        _fbText.Text = _cur.Type switch
        {
            ExType.Choice or ExType.Listen => "Atalho: teclas 1–4 para escolher, Enter para verificar.",
            ExType.Typing => "Digite em romaji (ex.: \"arigatou\") — vira kana automaticamente. Enter para verificar.",
            ExType.Order => "Clique nas peças na ordem certa. Clique numa peça já colocada para devolvê-la.",
            _ => ""
        };
        _fbText.ForeColor = Theme.Muted;
        _fbSpeak.Visible = false;
        _mainBtn.Text = "Verificar";
        _mainBtn.BaseColor = Theme.Accent;
        _mainBtn.HoverColor = Theme.AccentDark;
        _mainBtn.Enabled = false;

        if (_retried.Contains(_cur))
            _body.Add(Ui.Label("↻ Revisão de um erro anterior", Theme.UiSemi(9.5f), Theme.Warning));

        if (!string.IsNullOrWhiteSpace(_cur.Context))
            _body.Add(new InfoBox("📍 " + _cur.Context, Theme.Jp(11f), Theme.Indigo, Theme.IndigoSoft));

        _body.Add(Ui.Label(_cur.Prompt, Theme.Ui(15f, FontStyle.Bold), Theme.Text));

        bool audioAllowed = Speech.Available && (_cur.Type == ExType.Listen || (_cur.Japanese != null && !_cur.AudioRevealsAnswer));

        if (_cur.Type == ExType.Listen)
        {
            var row = Ui.Row(
                MakeSpeakButton("Ouvir", false),
                MakeSpeakButton("Devagar", true));
            _body.Add(row);
            if (!Speech.Available)
                _body.Add(Ui.Label("(Sem voz japonesa instalada — leia o texto)  " + _cur.SpeakText, Theme.Jp(16f), Theme.Warning));
        }

        if (!string.IsNullOrWhiteSpace(_cur.Japanese))
        {
            var jp = _cur.Japanese!;
            var size = _cur.BigJapanese ? 54f : jp.Length > 22 ? 18f : 24f;
            string? reading = _cur.JapaneseReading != null && ProgressStore.Data.Settings.ShowReading ? _cur.JapaneseReading : null;
            string? romaji = null;
            var romSource = _cur.JapaneseReading ?? jp;
            if (ProgressStore.Data.Settings.ShowRomaji && !_cur.BigJapanese && !_cur.AudioRevealsAnswer && !romSource.Contains("___") &&
                Kana.IsAllKana(romSource.Replace("。", "").Replace("、", "").Replace("？", "").Replace("！", "")))
                romaji = Kana.ToRomaji(romSource);
            bool speakBtn = audioAllowed && _cur.Type != ExType.Listen;
            _body.Add(new JpBlock(jp, size, reading, romaji,
                speakBtn ? () => Speech.Speak(_cur.SpeakText) : null,
                speakBtn ? () => Speech.Speak(_cur.SpeakText, true) : null));
        }

        switch (_cur.Type)
        {
            case ExType.Choice:
            case ExType.Listen:
                BuildOptions();
                break;
            case ExType.Typing:
                BuildTyping();
                break;
            case ExType.Order:
                BuildOrder();
                break;
        }

        _body.ResumeLayout(true);
        _body.PerformLayout();
        LayoutBottom();

        bool autoplay = Speech.Available && (_cur.Type == ExType.Listen ||
            (ProgressStore.Data.Settings.AutoPlayAudio && _cur.Type == ExType.Choice && _cur.Japanese != null && !_cur.AudioRevealsAnswer && !_cur.Japanese.Contains("___")));
        var ex = _cur;
        var input = _input;
        Post(() =>
        {
            if (ex != _cur) return;
            if (autoplay) Speech.Speak(ex.SpeakText);
            if (input != null && !input.IsDisposed) input.Focus();
            else Focus();
        });
    }

    /// <summary>Executa depois que o controle estiver na tela (o identificador da janela existir).</summary>
    private void Post(Action action)
    {
        if (IsHandleCreated)
        {
            BeginInvoke(action);
            return;
        }
        EventHandler? handler = null;
        handler = (_, _) =>
        {
            HandleCreated -= handler;
            BeginInvoke(action);
        };
        HandleCreated += handler;
    }

    private FlatButton MakeSpeakButton(string text, bool slow)
    {
        var b = FlatButton.Primary(text, (_, _) => Speech.Speak(_cur.SpeakText, slow));
        b.Glyph = Glyphs.Volume;
        b.BaseColor = slow ? Theme.IndigoSoft : Theme.Indigo;
        b.HoverColor = slow ? Theme.Blend(Theme.IndigoSoft, Color.Black, 0.08f) : Theme.Blend(Theme.Indigo, Color.Black, 0.15f);
        b.ForeColor = slow ? Theme.Indigo : Color.White;
        b.Font = Theme.UiSemi(12f);
        b.FitWidth();
        b.Height = Theme.S(56);
        return b;
    }

    private void BuildOptions()
    {
        for (int i = 0; i < _cur.Options.Count; i++)
        {
            int idx = i;
            var opt = _cur.Options[i];
            var b = new FlatButton
            {
                Text = $"{i + 1}.  {opt}",
                BaseColor = Color.White,
                HoverColor = Theme.IndigoSoft,
                ForeColor = Theme.Text,
                BorderColor = Theme.Border,
                TextAlign = ContentAlignment.MiddleLeft,
                Font = _cur.OptionsJapanese && Kana.ContainsJapanese(opt) ? Theme.Jp(opt.Length <= 3 ? 20f : 14f) : Theme.Ui(12f),
                Height = Theme.S(_cur.OptionsJapanese && opt.Length <= 3 ? 62 : 54),
                Margin = new Padding(0),
            };
            var textH = TextRenderer.MeasureText(b.Text, b.Font, new Size(Theme.S(700), int.MaxValue), TextFormatFlags.WordBreak).Height;
            b.Height = Math.Max(b.Height, textH + Theme.S(24));
            b.Click += (_, _) => SelectOption(idx);
            _optionButtons.Add(b);
            _body.Add(b);
        }
    }

    private void SelectOption(int idx)
    {
        if (_answered) return;
        _selected = idx;
        for (int i = 0; i < _optionButtons.Count; i++)
        {
            var b = _optionButtons[i];
            b.BaseColor = i == idx ? Theme.IndigoSoft : Color.White;
            b.BorderColor = i == idx ? Theme.Indigo : Theme.Border;
            b.Invalidate();
        }
        _mainBtn.Enabled = true;
    }

    private void BuildTyping()
    {
        _input = new TextBox
        {
            Font = Theme.Jp(18f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, Theme.S(6), 0, 0),
            ImeMode = ImeMode.NoControl,
        };
        _preview = Ui.Label("→ ", Theme.Jp(16f), Theme.Indigo);
        _input.TextChanged += (_, _) =>
        {
            var t = _input.Text;
            var conv = Kana.RomajiToHiragana(t, finalize: false);
            _preview.Text = "→ " + conv;
            _mainBtn.Enabled = t.Trim().Length > 0;
        };
        _input.KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                MainAction();
            }
        };
        _body.Add(_input);
        _body.Add(_preview);
        if (!string.IsNullOrWhiteSpace(_cur.Hint))
        {
            var hintBtn = FlatButton.Secondary("Dica", null);
            hintBtn.Glyph = Glyphs.Lightbulb;
            hintBtn.FitWidth();
            hintBtn.Tag = "fixed";
            hintBtn.Click += (_, _) =>
            {
                hintBtn.Text = _cur.Hint!;
                hintBtn.Font = Theme.Jp(10.5f);
                hintBtn.FitWidth();
                _body.PerformLayout();
                _input.Focus();
            };
            _body.Add(hintBtn);
        }
    }

    private void BuildOrder()
    {
        _answerArea = new FlowLayoutPanel
        {
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            WrapContents = true,
            BackColor = Color.White,
            Padding = Theme.Pad(10),
            MinimumSize = new Size(0, Theme.S(74)),
            BorderStyle = BorderStyle.FixedSingle,
        };
        _bankArea = new FlowLayoutPanel
        {
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            WrapContents = true,
            BackColor = Theme.Background,
            Padding = Theme.Pad(2, 8, 2, 2),
        };
        _body.Add(Ui.Label("Sua frase:", Theme.Ui(10f), Theme.Muted));
        _body.Add(_answerArea);
        _body.Add(Ui.Label("Peças:", Theme.Ui(10f), Theme.Muted));
        _body.Add(_bankArea);
        foreach (var t in _cur.Tiles) _bankArea.Controls.Add(MakeTile(t));
    }

    private FlatButton MakeTile(string text)
    {
        var b = new FlatButton
        {
            Text = text,
            BaseColor = Color.White,
            HoverColor = Theme.IndigoSoft,
            ForeColor = Theme.Text,
            BorderColor = Theme.Border,
            Font = Theme.Jp(15f),
            TextPadding = new Padding(10, 4, 10, 4),
            Margin = new Padding(0, 0, Theme.S(8), Theme.S(8)),
            Height = Theme.S(48),
        };
        b.FitWidth();
        b.Height = Theme.S(48);
        b.Click += (_, _) =>
        {
            if (_answered || _answerArea == null || _bankArea == null) return;
            if (b.Parent == _bankArea)
            {
                _bankArea.Controls.Remove(b);
                _answerArea.Controls.Add(b);
                b.BaseColor = Theme.IndigoSoft;
            }
            else
            {
                _answerArea.Controls.Remove(b);
                _bankArea.Controls.Add(b);
                b.BaseColor = Color.White;
            }
            _mainBtn.Enabled = _answerArea.Controls.Count > 0;
            _body.PerformLayout();
        };
        return b;
    }

    // =========================================================
    private void MainAction()
    {
        if (!_mainBtn.Enabled && !_answered) return;
        if (!_answered) Check();
        else Next();
    }

    private void Check()
    {
        bool correct = false;
        bool lenient = false;
        string? userAnswer = null;

        switch (_cur.Type)
        {
            case ExType.Choice:
            case ExType.Listen:
                if (_selected < 0) return;
                correct = _selected == _cur.Answer;
                for (int i = 0; i < _optionButtons.Count; i++)
                {
                    var b = _optionButtons[i];
                    if (i == _cur.Answer) { b.BaseColor = Theme.SuccessSoft; b.BorderColor = Theme.Success; }
                    else if (i == _selected) { b.BaseColor = Theme.ErrorSoft; b.BorderColor = Theme.Error; }
                    b.HoverColor = b.BaseColor;
                    b.Cursor = Cursors.Default;
                    b.Invalidate();
                }
                break;
            case ExType.Typing:
                if (_input == null) return;
                userAnswer = _input.Text;
                foreach (var acc in _cur.Accepted)
                {
                    var r = Kana.Compare(userAnswer, acc);
                    if (r == Kana.MatchResult.Exact) { correct = true; lenient = false; break; }
                    if (r == Kana.MatchResult.ParticleLenient) { correct = true; lenient = true; }
                }
                _input.ReadOnly = true;
                _input.BackColor = correct ? Theme.SuccessSoft : Theme.ErrorSoft;
                break;
            case ExType.Order:
                if (_answerArea == null) return;
                var built = string.Join("", _answerArea.Controls.Cast<Control>().Select(c => c.Text));
                var target = string.Join("", _cur.Correct);
                correct = Kana.NormalizeAnswer(built) == Kana.NormalizeAnswer(target) || built.Replace(" ", "") == target.Replace(" ", "");
                _answerArea.BackColor = correct ? Theme.SuccessSoft : Theme.ErrorSoft;
                break;
        }

        _answered = true;
        bool firstTime = !_failed.Contains(_cur) && !_retried.Contains(_cur);
        if (correct)
        {
            if (firstTime) _firstTryCorrect++;
            ProgressStore.RecordHit(_cur.StatKey);
        }
        else
        {
            ProgressStore.RecordMistake(_cur.StatKey);
            if (!_failed.Contains(_cur) && !_retried.Contains(_cur))
            {
                _failed.Add(_cur);
                // repete no fim (uma vez)
                var again = CloneForRetry(_cur);
                _retried.Add(again);
                _queue.Add(again);
            }
        }
        ShowFeedback(correct, lenient);
    }

    private static Exercise CloneForRetry(Exercise e)
    {
        var c = new Exercise
        {
            Type = e.Type,
            Context = e.Context,
            Prompt = e.Prompt,
            Japanese = e.Japanese,
            JapaneseReading = e.JapaneseReading,
            SpeakText = e.SpeakText,
            Accepted = e.Accepted,
            Correct = e.Correct,
            Explanation = e.Explanation,
            Hint = e.Hint,
            StatKey = e.StatKey,
            BigJapanese = e.BigJapanese,
            OptionsJapanese = e.OptionsJapanese,
            AudioRevealsAnswer = e.AudioRevealsAnswer,
            Tiles = ExerciseFactory.Shuffle(e.Tiles),
        };
        if (e.Options.Count > 0)
        {
            var correct = e.Options[e.Answer];
            c.Options = ExerciseFactory.Shuffle(e.Options);
            c.Answer = c.Options.IndexOf(correct);
        }
        return c;
    }

    private void ShowFeedback(bool correct, bool lenient)
    {
        _bottom.BackColor = correct ? Theme.SuccessSoft : Theme.ErrorSoft;
        _fbTitle.ForeColor = correct ? Theme.Success : Theme.Error;
        _fbText.ForeColor = Theme.Text;
        string[] praise = { "Correto! 正解！", "Muito bem! よくできました！", "Isso aí! すごい！", "Perfeito! 完璧！" };
        _fbTitle.Text = correct ? praise[Random.Shared.Next(praise.Length)] : "Não foi dessa vez…";

        var lines = new List<string>();
        if (!correct)
        {
            var ans = _cur.CorrectAnswerText;
            var line = "Resposta certa: " + ans;
            if (ProgressStore.Data.Settings.ShowRomaji && Kana.IsAllKana(ans.Replace(" ", "")) && _cur.Type != ExType.Order)
                line += $"  ({Kana.ToRomaji(ans)})";
            lines.Add(line);
        }
        if (lenient)
            lines.Add("Obs.: as partículas は, へ, を se escrevem ha, he, wo (lidas wa, e, o).");
        if (!string.IsNullOrWhiteSpace(_cur.Explanation)) lines.Add(_cur.Explanation!);
        _fbText.Text = string.Join("\n", lines);

        _fbSpeak.Visible = Speech.Available && !string.IsNullOrWhiteSpace(_cur.SpeakText);
        _mainBtn.Text = "Continuar";
        _mainBtn.BaseColor = correct ? Theme.Success : Theme.Error;
        _mainBtn.HoverColor = Theme.Blend(_mainBtn.BaseColor, Color.Black, 0.15f);
        _mainBtn.Enabled = true;
        _mainBtn.Invalidate();
        _mainBtn.Focus();
        LayoutBottom();

        if (Speech.Available && !string.IsNullOrWhiteSpace(_cur.SpeakText) && (_cur.Type == ExType.Order || _cur.AudioRevealsAnswer || _cur.Japanese == null))
            Speech.Speak(_cur.SpeakText);
    }

    private void Next()
    {
        _pos++;
        if (_pos >= _queue.Count) Finish();
        else ShowExercise();
    }

    private void Finish()
    {
        Speech.Stop();
        _progress.Value = 1;
        _bottom.Visible = false;
        int pct = (int)Math.Round(100.0 * _firstTryCorrect / Math.Max(1, _originalCount));
        var mistakes = _failed.ToList();
        var extra = _onComplete?.Invoke(new RunResult(_firstTryCorrect, _originalCount, pct, mistakes));
        ProgressStore.Save();

        _body.SuspendLayout();
        foreach (Control c in _body.Controls.Cast<Control>().ToList()) c.Dispose();
        _body.Controls.Clear();

        string kanjiFace = pct >= 90 ? "素晴らしい！" : pct >= 70 ? "よくできました！" : pct >= 50 ? "もう少し！" : "がんばって！";
        string msg = pct >= 90 ? "Excelente! Você dominou este conteúdo." :
                     pct >= 70 ? "Muito bom! Conteúdo aprovado." :
                     pct >= 50 ? "Quase lá. Revise a teoria e tente de novo." :
                     "Vale revisar a teoria antes de tentar de novo — errar faz parte!";

        var big = Ui.Label(kanjiFace, Theme.Jp(30f, FontStyle.Bold), pct >= 70 ? Theme.Success : Theme.Accent);
        big.Tag = "center";
        _body.Add(big);
        var score = Ui.Label($"{pct}%", Theme.Ui(44f, FontStyle.Bold), Theme.Text);
        score.Tag = "center";
        _body.Add(score);
        var info = Ui.Label($"{_firstTryCorrect} de {_originalCount} certas de primeira  ·  {msg}", Theme.Ui(12f), Theme.Muted);
        info.Tag = "center";
        _body.Add(info);
        if (!string.IsNullOrWhiteSpace(extra))
        {
            var ex = Ui.Label(extra!, Theme.UiSemi(12f), Theme.Indigo);
            ex.Tag = "center";
            _body.Add(ex);
        }

        var buttons = Ui.Row(
            FlatButton.Primary("Concluir", (_, _) => _onExit()),
            FlatButton.Secondary("Repetir exercícios", (_, _) => Start()));
        buttons.Tag = "center";
        buttons.AutoSize = true;
        _body.Add(buttons);

        if (mistakes.Count > 0)
        {
            _body.Add(Ui.Section("Revise o que você errou"));
            foreach (var m in mistakes)
            {
                var q = m.Japanese != null ? $"{m.Prompt}  {m.Japanese}" : m.Prompt;
                var card = new SentenceCard(m.CorrectAnswerText, "", q + (string.IsNullOrWhiteSpace(m.Explanation) ? "" : "\n" + m.Explanation));
                _body.Add(card);
            }
        }
        _body.ResumeLayout(true);
        _body.PerformLayout();
    }

    // ===== ganchos usados só pelo modo de teste (--shots) =====
    internal void TestAnswer(bool correct)
    {
        if (_answered) Next();
        if (_pos >= _queue.Count) return;
        switch (_cur.Type)
        {
            case ExType.Choice:
            case ExType.Listen:
                SelectOption(correct ? _cur.Answer : (_cur.Answer + 1) % _cur.Options.Count);
                break;
            case ExType.Typing:
                var kana = _cur.Accepted.Select(Kana.NormalizeAnswer).FirstOrDefault(Kana.IsAllKana) ?? "";
                _input!.Text = correct ? Kana.ToRomaji(kana) : "zzz";
                break;
            case ExType.Order:
                var seq = correct ? _cur.Correct : Enumerable.Reverse(_cur.Correct).ToList();
                foreach (var t in seq)
                {
                    var tile = _bankArea!.Controls.Cast<FlatButton>().FirstOrDefault(b => b.Text == t);
                    tile?.PerformClick();
                }
                break;
        }
        Check();
    }

    internal void TestFinishAll()
    {
        int guard = 0;
        while (_pos < _queue.Count && guard++ < 200)
        {
            if (!_answered) TestAnswer(true);
            Next();
        }
    }

    // =========================================================
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (_bottom.Visible && _pos < _queue.Count)
        {
            if (keyData == Keys.Enter && (_input == null || !_input.Focused))
            {
                MainAction();
                return true;
            }
            if (!_answered && (_cur.Type == ExType.Choice || _cur.Type == ExType.Listen))
            {
                int n = keyData switch
                {
                    Keys.D1 or Keys.NumPad1 => 0,
                    Keys.D2 or Keys.NumPad2 => 1,
                    Keys.D3 or Keys.NumPad3 => 2,
                    Keys.D4 or Keys.NumPad4 => 3,
                    Keys.D5 or Keys.NumPad5 => 4,
                    _ => -1
                };
                if (n >= 0 && n < _optionButtons.Count)
                {
                    SelectOption(n);
                    return true;
                }
                if (keyData == Keys.Space && Speech.Available && _cur.Type == ExType.Listen)
                {
                    Speech.Speak(_cur.SpeakText);
                    return true;
                }
            }
        }
        if (keyData == Keys.Escape)
        {
            ConfirmExit();
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}
