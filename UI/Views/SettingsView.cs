using System.Diagnostics;
using JapHelp.Core;

namespace JapHelp.UI.Views;

public class SettingsView : UserControl
{
    public SettingsView()
    {
        BackColor = Theme.Background;
        var s = ProgressStore.Data.Settings;
        var stack = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(36, 28, 36, 28), MaxContentWidth = Theme.S(820), Spacing = 10 };
        Controls.Add(stack);

        stack.Add(Ui.Title("Configurações"));

        // ---- exibição
        stack.Add(Ui.Section("Exibição"));
        stack.Add(Check("Mostrar romaji (letras latinas) junto do japonês", s.ShowRomaji, v => s.ShowRomaji = v));
        stack.Add(Ui.Label("Recomendado: desligue o romaji depois de terminar o Nível 0 — ele vira muleta e atrapalha a leitura de kana.", Theme.Ui(9.5f), Theme.Muted));
        stack.Add(Check("Mostrar leitura em kana para palavras com kanji (furigana)", s.ShowReading, v => s.ShowReading = v));
        stack.Add(Check("Tocar áudio automaticamente nos exercícios e revisões", s.AutoPlayAudio, v => s.AutoPlayAudio = v));

        // ---- meta
        stack.Add(Ui.Section("Metas"));
        var goal = new NumericUpDown { Minimum = 10, Maximum = 500, Increment = 10, Value = Math.Clamp(s.DailyGoalXp, 10, 500), Width = Theme.S(90), Font = Theme.Ui(11f) };
        goal.ValueChanged += (_, _) => { s.DailyGoalXp = (int)goal.Value; ProgressStore.Save(); };
        var maxRev = new NumericUpDown { Minimum = 10, Maximum = 300, Increment = 10, Value = Math.Clamp(s.MaxReviewsPerSession, 10, 300), Width = Theme.S(90), Font = Theme.Ui(11f) };
        maxRev.ValueChanged += (_, _) => { s.MaxReviewsPerSession = (int)maxRev.Value; ProgressStore.Save(); };
        stack.Add(Ui.Row(Ui.Label("Meta diária de XP:", Theme.Ui(11f), Theme.Text, new Padding(0, Theme.S(4), 0, 0)), goal,
                         Ui.Label("Máx. de cartões por revisão:", Theme.Ui(11f), Theme.Text, new Padding(Theme.S(20), Theme.S(4), 0, 0)), maxRev));

        // ---- voz
        stack.Add(Ui.Section("Voz (áudio em japonês)"));
        var jaVoices = Speech.JapaneseVoices;
        if (Speech.Available)
        {
            stack.Add(new InfoBox($"✓ {jaVoices.Count} voz(es) japonesa(s) encontrada(s). Em uso: {Speech.VoiceName}", Theme.Ui(11f), Theme.Success, Theme.SuccessSoft));
            var combo = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = Theme.S(380), Font = Theme.Ui(10.5f) };
            foreach (var v in jaVoices) combo.Items.Add(v);
            combo.SelectedItem = jaVoices.FirstOrDefault(v => v.Id == Speech.CurrentVoiceId);
            combo.SelectedIndexChanged += (_, _) =>
            {
                if (combo.SelectedItem is Speech.VoiceInfo v && Speech.SelectVoice(v.Id))
                {
                    s.VoiceId = v.Id;
                    ProgressStore.Save();
                    Speech.Speak("こんにちは。わたしの こえは どうですか。");
                }
            };
            stack.Add(Ui.Row(Ui.Label("Voz:", Theme.Ui(11f), Theme.Text, new Padding(0, Theme.S(4), 0, 0)), combo));

            var speedLabel = Ui.Label($"Velocidade: {Speech.Speed:0.00}×", Theme.Ui(11f), Theme.Text, new Padding(0, Theme.S(8), 0, 0));
            var rate = new TrackBar { Minimum = 50, Maximum = 150, Value = (int)Math.Clamp(Speech.Speed * 100, 50, 150), TickFrequency = 10, SmallChange = 5, LargeChange = 10, Width = Theme.S(260), AutoSize = false, Height = Theme.S(40), BackColor = Theme.Background };
            rate.ValueChanged += (_, _) =>
            {
                Speech.Speed = rate.Value / 100.0;
                s.SpeechSpeed = Speech.Speed;
                speedLabel.Text = $"Velocidade: {Speech.Speed:0.00}×";
                ProgressStore.Save();
            };
            var test = FlatButton.Secondary("Testar", (_, _) => Speech.Speak("こんにちは。いっしょに日本語を勉強しましょう。"));
            test.Glyph = Glyphs.Volume;
            test.FitWidth();
            stack.Add(Ui.Row(speedLabel, rate, test));
            stack.Add(Ui.Label("Dica: comece em 0,8× para aprender e suba até 1,1× para treinar o ouvido para a velocidade real.", Theme.Ui(9.5f), Theme.Muted));
        }
        else
        {
            stack.Add(new InfoBox(
                "Nenhuma voz japonesa instalada. Sem ela, os exercícios de escuta e o treino de fala ficam limitados.\n\n" +
                "Como instalar (Windows 10/11, leva uns 5 minutos):\n" +
                "1. Clique em \"Abrir Idioma\" abaixo (Configurações → Hora e idioma → Idioma).\n" +
                "2. Clique em \"Adicionar um idioma\" e escolha 日本語 (Japonês).\n" +
                "3. Marque \"Conversão de texto em fala\" e \"Reconhecimento de fala\". Desmarque \"Definir como idioma de exibição\".\n" +
                "4. Aguarde o download terminar e reabra o JapHelp.",
                Theme.Ui(10.5f), Theme.AccentDark, Theme.ErrorSoft));
        }

        // ---- diagnóstico
        stack.Add(Ui.Section("Diagnóstico de áudio e fala"));
        var others = Speech.AllVoices.Where(v => !v.IsJapanese).Select(v => $"{v.Name} ({v.Language})").Distinct().ToList();
        var recLangs = SpeechPractice.RecognizerLanguages();
        stack.Add(new InfoBox(
            "Vozes japonesas: " + (jaVoices.Count == 0 ? "nenhuma" : string.Join(", ", jaVoices.Select(v => v.Name))) + "\n" +
            "Outras vozes no Windows: " + (others.Count == 0 ? "nenhuma" : string.Join(", ", others)) + "\n" +
            "Reconhecimento de fala disponível para: " + (recLangs.Count == 0 ? "nenhum idioma" : string.Join(", ", recLangs)) +
            (SpeechPractice.JapaneseRecognitionAvailable ? "  ✓ japonês" : "  ✗ japonês (instale o reconhecimento de fala japonês)") + "\n" +
            "Gravação pelo microfone: " + (SpeechPractice.HasMicrophone ? "✓ microfone encontrado" : "✗ nenhum microfone encontrado"),
            Theme.Jp(10f), Theme.Text, Color.White) { BorderColor = Theme.Border });
        stack.Add(Ui.Row(
            FlatButton.Secondary("Abrir Idioma (instalar japonês)", (_, _) => Speech.OpenSettings("ms-settings:regionlanguage")),
            FlatButton.Secondary("Vozes do Windows", (_, _) => Speech.OpenSettings("ms-settings:speech")),
            FlatButton.Secondary("Permissão do microfone", (_, _) => Speech.OpenSettings("ms-settings:privacy-microphone")),
            FlatButton.Secondary("Reconhecimento de fala online", (_, _) => Speech.OpenSettings("ms-settings:privacy-speech"))));
        stack.Add(Ui.Label("Depois de instalar algo no Windows, feche e abra o JapHelp de novo para ele detectar.", Theme.Ui(9.5f), Theme.Muted));

        // ---- dados
        stack.Add(Ui.Section("Dados"));
        stack.Add(Ui.Label("Seu progresso fica salvo em: " + ProgressStore.FilePath, Theme.Ui(10f), Theme.Muted));
        stack.Add(Ui.Label("O conteúdo do curso fica em: " + ContentRepository.ContentDir + "  (arquivos JSON/TXT editáveis — você pode adicionar lições!)", Theme.Ui(10f), Theme.Muted));
        stack.Add(Ui.Row(
            FlatButton.Secondary("Abrir pasta do progresso", (_, _) => OpenFolder(ProgressStore.FolderPath)),
            FlatButton.Secondary("Abrir pasta do conteúdo", (_, _) => OpenFolder(ContentRepository.ContentDir)),
            FlatButton.Secondary("Recarregar conteúdo", (_, _) =>
            {
                ContentRepository.Load();
                MessageBox.Show(ContentRepository.Errors.Count == 0
                    ? $"Conteúdo recarregado: {ContentRepository.AllLessons.Count()} lições, {ContentRepository.Kanji.Count} kanji, {ContentRepository.Phrases.Sum(p => p.Phrases.Count)} frases."
                    : "Erros:\n" + string.Join("\n", ContentRepository.Errors), "JapHelp");
            })));

        var reset = FlatButton.Primary("Zerar todo o progresso", (_, _) =>
        {
            if (MessageBox.Show("Isso apaga lições concluídas, XP, sequência e toda a revisão (SRS). Não dá para desfazer. Continuar?",
                    "Zerar progresso", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
            {
                ProgressStore.Reset();
                MainForm.Instance.Navigate("home");
            }
        });
        reset.BaseColor = Theme.Error;
        reset.Glyph = Glyphs.Delete;
        reset.FitWidth();
        reset.Tag = "fixed";
        stack.Add(Ui.Spacer(10));
        stack.Add(reset);
    }

    private static CheckBox Check(string text, bool value, Action<bool> set)
    {
        var c = new CheckBox { Text = text, Checked = value, AutoSize = true, Font = Theme.Ui(11f), ForeColor = Theme.Text, BackColor = Color.Transparent };
        c.CheckedChanged += (_, _) => { set(c.Checked); ProgressStore.Save(); };
        return c;
    }

    private static void OpenFolder(string path)
    {
        try
        {
            Directory.CreateDirectory(path);
            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{path}\"") { UseShellExecute = true });
        }
        catch { }
    }
}
