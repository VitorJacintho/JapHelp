using System.Media;
using System.Runtime.InteropServices;
using System.Text;
using Windows.Media.SpeechRecognition;

namespace JapHelp.Core;

/// <summary>
/// Treino de fala: gravar a própria voz (winmm/MCI, funciona em qualquer Windows)
/// e reconhecer o que foi dito (WinRT SpeechRecognizer, precisa do pacote de fala japonês).
/// </summary>
public static class SpeechPractice
{
    public record Outcome(bool Ok, string Heard, double Score, string Mode, string Message);

    // ================== reconhecimento ==================
    public static List<string> RecognizerLanguages()
    {
        try
        {
            return SpeechRecognizer.SupportedTopicLanguages.Select(l => l.LanguageTag)
                .Concat(SpeechRecognizer.SupportedGrammarLanguages.Select(l => l.LanguageTag))
                .Distinct().ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    public static bool JapaneseRecognitionAvailable => RecognizerLanguages().Any(l => l.StartsWith("ja", StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Ouve o microfone e compara com a frase esperada.
    /// Tenta ditado livre (mostra exatamente o que foi entendido); se o reconhecimento online
    /// estiver desligado, usa reconhecimento local restrito à frase (dá só a confiança).
    /// </summary>
    public static async Task<Outcome> RecognizeAsync(string expected, string? reading = null)
    {
        var o = await RecognizeCoreAsync(expected);
        if (o.Ok && reading != null && o.Mode == "ditado")
            o = o with { Score = Math.Max(o.Score, Similarity(o.Heard, reading)) };
        return o;
    }

    private static async Task<Outcome> RecognizeCoreAsync(string expected)
    {
        if (!JapaneseRecognitionAvailable)
            return new Outcome(false, "", 0, "", "Reconhecimento de fala em japonês não está instalado no Windows.");

        var lang = new Windows.Globalization.Language("ja-JP");
        try
        {
            using var rec = new SpeechRecognizer(lang);
            rec.Timeouts.InitialSilenceTimeout = TimeSpan.FromSeconds(6);
            rec.Timeouts.EndSilenceTimeout = TimeSpan.FromSeconds(1.2);
            rec.Constraints.Add(new SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.Dictation, "dictation"));
            var comp = await rec.CompileConstraintsAsync();
            if (comp.Status == SpeechRecognitionResultStatus.Success)
            {
                var r = await rec.RecognizeAsync();
                if (r.Status == SpeechRecognitionResultStatus.Success)
                {
                    var heard = r.Text ?? "";
                    var score = Similarity(heard, expected);
                    return new Outcome(heard.Length > 0, heard, score, "ditado", heard.Length == 0 ? "Não ouvi nada. Fale mais perto do microfone." : "");
                }
                if (r.Status != SpeechRecognitionResultStatus.NetworkFailure)
                    return new Outcome(false, "", 0, "ditado", Describe(r.Status));
            }
        }
        catch (Exception ex) when (IsPrivacyError(ex))
        {
            // reconhecimento online desligado: cai para o modo local
        }
        catch (UnauthorizedAccessException)
        {
            return new Outcome(false, "", 0, "", "Sem permissão para usar o microfone. Libere em Configurações → Privacidade → Microfone (apps da área de trabalho).");
        }
        catch (Exception ex)
        {
            if ((uint)ex.HResult == 0x80070005)
                return new Outcome(false, "", 0, "", "Sem permissão para usar o microfone. Libere em Configurações → Privacidade → Microfone.");
        }

        // modo local: só a frase esperada
        try
        {
            using var rec = new SpeechRecognizer(lang);
            rec.Timeouts.InitialSilenceTimeout = TimeSpan.FromSeconds(6);
            rec.Constraints.Add(new SpeechRecognitionListConstraint(new[] { expected }, "alvo"));
            var comp = await rec.CompileConstraintsAsync();
            if (comp.Status != SpeechRecognitionResultStatus.Success)
                return new Outcome(false, "", 0, "local", Describe(comp.Status));
            var r = await rec.RecognizeAsync();
            if (r.Status != SpeechRecognitionResultStatus.Success)
                return new Outcome(false, "", 0, "local", Describe(r.Status));
            double score = r.Confidence switch
            {
                SpeechRecognitionConfidence.High => 0.95,
                SpeechRecognitionConfidence.Medium => 0.75,
                SpeechRecognitionConfidence.Low => 0.45,
                _ => 0.1,
            };
            var heard = r.Confidence == SpeechRecognitionConfidence.Rejected ? "" : r.Text;
            return new Outcome(true, heard, score, "local",
                "Modo local (sem ditado): só confere se você disse a frase. Ative o \"Reconhecimento de fala online\" para ver exatamente o que foi entendido.");
        }
        catch (Exception ex)
        {
            return new Outcome(false, "", 0, "local", "Erro no reconhecimento: " + ex.Message);
        }
    }

    private static bool IsPrivacyError(Exception ex) => (uint)ex.HResult == 0x80045509;

    private static string Describe(SpeechRecognitionResultStatus s) => s switch
    {
        SpeechRecognitionResultStatus.TimeoutExceeded => "Não ouvi nada a tempo. Clique e fale logo em seguida.",
        SpeechRecognitionResultStatus.AudioQualityFailure => "Áudio ruim. Verifique o microfone.",
        SpeechRecognitionResultStatus.MicrophoneUnavailable => "Microfone indisponível.",
        SpeechRecognitionResultStatus.NetworkFailure => "Falha de rede no reconhecimento online.",
        SpeechRecognitionResultStatus.UserCanceled => "Cancelado.",
        _ => "Não foi possível reconhecer (" + s + ")."
    };

    /// <summary>Semelhança 0..1 entre o que foi ouvido e o esperado (comparando em kana e em texto original).</summary>
    public static double Similarity(string heard, string expected)
    {
        static string Norm(string s) => new string(Kana.NormalizeAnswer(s).Where(c => !char.IsPunctuation(c)).ToArray());
        var a = Norm(heard);
        var b = Norm(expected);
        if (a.Length == 0 || b.Length == 0) return 0;
        int d = Levenshtein(a, b);
        return Math.Max(0, 1.0 - (double)d / Math.Max(a.Length, b.Length));
    }

    private static int Levenshtein(string a, string b)
    {
        var prev = new int[b.Length + 1];
        var cur = new int[b.Length + 1];
        for (int j = 0; j <= b.Length; j++) prev[j] = j;
        for (int i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            for (int j = 1; j <= b.Length; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                cur[j] = Math.Min(Math.Min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            (prev, cur) = (cur, prev);
        }
        return prev[b.Length];
    }

    // ================== gravação (MCI) ==================
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern int mciSendString(string command, StringBuilder? returnValue, int returnLength, IntPtr callback);

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern bool mciGetErrorString(int error, StringBuilder text, int length);

    [DllImport("winmm.dll")]
    private static extern int waveInGetNumDevs();

    public static bool HasMicrophone
    {
        get { try { return waveInGetNumDevs() > 0; } catch { return false; } }
    }

    public static bool IsRecording { get; private set; }

    public static string RecordingPath => Path.Combine(ProgressStore.FolderPath, "minha_voz.wav");

    private static string Mci(string cmd)
    {
        int err = mciSendString(cmd, null, 0, IntPtr.Zero);
        if (err == 0) return "";
        var sb = new StringBuilder(256);
        mciGetErrorString(err, sb, sb.Capacity);
        return sb.ToString();
    }

    /// <summary>Começa a gravar. Retorna mensagem de erro ou "" se ok.</summary>
    public static string StartRecording()
    {
        if (!HasMicrophone) return "Nenhum microfone encontrado.";
        Mci("close jhrec");
        var e = Mci("open new type waveaudio alias jhrec");
        if (e != "") return e;
        Mci("set jhrec bitspersample 16 samplespersec 22050 channels 1");
        e = Mci("record jhrec");
        if (e != "") { Mci("close jhrec"); return e; }
        IsRecording = true;
        return "";
    }

    /// <summary>Para e salva a gravação em RecordingPath.</summary>
    public static string StopRecording()
    {
        if (!IsRecording) return "";
        IsRecording = false;
        Directory.CreateDirectory(ProgressStore.FolderPath);
        Mci("stop jhrec");
        var e = Mci($"save jhrec \"{RecordingPath}\"");
        Mci("close jhrec");
        return e;
    }

    public static bool HasRecording => File.Exists(RecordingPath);

    private static SoundPlayer? _player;

    public static Task PlayRecordingAsync()
    {
        if (!HasRecording) return Task.CompletedTask;
        return Task.Run(() =>
        {
            try
            {
                _player = new SoundPlayer(RecordingPath);
                _player.PlaySync();
            }
            catch { }
        });
    }

    public static void StopPlayback()
    {
        try { _player?.Stop(); } catch { }
    }
}
