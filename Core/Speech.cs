using System.Diagnostics;
using System.Media;
using System.Reflection;
using Windows.Media.SpeechSynthesis;

namespace JapHelp.Core;

/// <summary>
/// Síntese de voz em japonês.
/// Motor principal: WinRT (Windows.Media.SpeechSynthesis) — usa as vozes modernas do Windows
/// (Haruka, Ayumi, Ichiro, Nanami...), com velocidade ajustável e cache.
/// Reserva: SAPI 5 (COM) para vozes "Desktop" antigas.
/// </summary>
public static class Speech
{
    public record VoiceInfo(string Id, string Name, string Language, string Engine)
    {
        public bool IsJapanese => Language.StartsWith("ja", StringComparison.OrdinalIgnoreCase);
        public override string ToString() => $"{Name} ({Language}, {Engine})";
    }

    private static bool _initialized;
    private static SpeechSynthesizer? _synth;
    private static VoiceInformation? _winrtVoice;
    private static object? _sapiVoice;
    private static VoiceInfo? _current;

    private static SoundPlayer? _player;
    private static CancellationTokenSource? _cts;
    private static readonly Dictionary<string, byte[]> Cache = new();
    private const int MaxCache = 300;

    public static List<VoiceInfo> AllVoices { get; } = new();
    public static List<VoiceInfo> JapaneseVoices => AllVoices.Where(v => v.IsJapanese).ToList();
    public static bool Available => _current != null;
    public static string VoiceName => _current?.Name ?? "";
    public static string? CurrentVoiceId => _current?.Id;
    public static string LastError { get; private set; } = "";

    /// <summary>Velocidade normal (1.0 = padrão). O modo "devagar" usa 60% disso.</summary>
    public static double Speed { get; set; } = 0.9;

    /// <summary>Disparado quando uma fala termina (ou é interrompida).</summary>
    public static event Action? Finished;

    public static void Init(string? preferredVoiceId = null)
    {
        if (_initialized) return;
        _initialized = true;

        // 1) vozes modernas (OneCore) via WinRT
        try
        {
            _synth = new SpeechSynthesizer();
            foreach (var v in SpeechSynthesizer.AllVoices)
                AllVoices.Add(new VoiceInfo("winrt:" + v.Id, v.DisplayName, v.Language, "moderna"));
        }
        catch (Exception ex)
        {
            LastError = "WinRT: " + ex.Message;
            _synth = null;
        }

        // 2) vozes SAPI "Desktop"
        try
        {
            var voiceType = Type.GetTypeFromProgID("SAPI.SpVoice");
            if (voiceType != null)
            {
                _sapiVoice = Activator.CreateInstance(voiceType);
                var tokens = Invoke(_sapiVoice!, "GetVoices", "", "");
                int count = Convert.ToInt32(Get(tokens!, "Count"));
                for (int i = 0; i < count; i++)
                {
                    var tok = Invoke(tokens!, "Item", i)!;
                    var id = Convert.ToString(Get(tok, "Id")) ?? "";
                    var name = Convert.ToString(Invoke(tok, "GetDescription", 0)) ?? id;
                    string lang = "";
                    try { lang = LcidToTag(Convert.ToString(Invoke(tok, "GetAttribute", "Language")) ?? ""); } catch { }
                    AllVoices.Add(new VoiceInfo("sapi:" + id, name, lang, "SAPI"));
                }
            }
        }
        catch (Exception ex)
        {
            LastError += " SAPI: " + ex.Message;
        }

        var ja = JapaneseVoices;
        var pick = ja.FirstOrDefault(v => v.Id == preferredVoiceId)
                   ?? ja.FirstOrDefault(v => v.Engine == "moderna")
                   ?? ja.FirstOrDefault();
        if (pick != null) SelectVoice(pick.Id);
    }

    private static string LcidToTag(string hexList)
    {
        // "411" ou "411;409" -> ja-JP
        var first = hexList.Split(';')[0].Trim();
        if (int.TryParse(first, System.Globalization.NumberStyles.HexNumber, null, out var lcid))
        {
            try { return new System.Globalization.CultureInfo(lcid).Name; } catch { }
        }
        return hexList;
    }

    public static bool SelectVoice(string id)
    {
        var info = AllVoices.FirstOrDefault(v => v.Id == id);
        if (info == null) return false;
        try
        {
            if (info.Engine == "moderna" && _synth != null)
            {
                _winrtVoice = SpeechSynthesizer.AllVoices.First(v => "winrt:" + v.Id == id);
                _synth.Voice = _winrtVoice;
            }
            else if (_sapiVoice != null)
            {
                var tokens = Invoke(_sapiVoice, "GetVoices", "", "");
                int count = Convert.ToInt32(Get(tokens!, "Count"));
                for (int i = 0; i < count; i++)
                {
                    var tok = Invoke(tokens!, "Item", i)!;
                    if ("sapi:" + Convert.ToString(Get(tok, "Id")) == id)
                    {
                        SetProp(_sapiVoice, "Voice", tok);
                        break;
                    }
                }
            }
            _current = info;
            lock (Cache) Cache.Clear();
            return true;
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            return false;
        }
    }

    // ================== API usada pelas telas ==================

    /// <summary>Fala o texto (interrompe o que estiver falando).</summary>
    public static void Speak(string? text, bool slow = false)
    {
        if (!Available || string.IsNullOrWhiteSpace(text)) return;
        _ = SpeakAsync(new[] { text }, slow);
    }

    /// <summary>Fala várias linhas em sequência (ex.: diálogo inteiro).</summary>
    public static void SpeakQueue(IEnumerable<string> lines)
    {
        if (!Available) return;
        _ = SpeakAsync(lines.ToList(), false);
    }

    /// <summary>Fala e só retorna quando terminar (usado em "comparar" no treino de fala).</summary>
    public static Task SpeakAndWaitAsync(string text, bool slow = false) => SpeakAsync(new[] { text }, slow);

    public static void Stop()
    {
        try { _cts?.Cancel(); } catch { }
        try { _player?.Stop(); } catch { }
        if (_current?.Engine == "SAPI" && _sapiVoice != null)
        {
            try { Invoke(_sapiVoice, "Speak", "", 1 | 2); } catch { }
        }
    }

    private static async Task SpeakAsync(IList<string> lines, bool slow)
    {
        Stop();
        var cts = new CancellationTokenSource();
        _cts = cts;
        double rate = Math.Clamp(slow ? Speed * 0.6 : Speed, 0.5, 2.0);
        try
        {
            foreach (var raw in lines)
            {
                if (cts.IsCancellationRequested) return;
                var text = Clean(raw);
                if (text.Length == 0) continue;

                if (_current?.Engine == "SAPI")
                {
                    await SpeakSapiAsync(text, rate, cts.Token);
                    continue;
                }

                var wav = await SynthesizeAsync(text, rate);
                if (wav == null || cts.IsCancellationRequested) return;
                await Task.Run(() =>
                {
                    using var ms = new MemoryStream(wav);
                    var player = new SoundPlayer(ms);
                    _player = player;
                    if (!cts.IsCancellationRequested) player.PlaySync();
                });
            }
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            Debug.WriteLine("Speak failed: " + ex);
        }
        finally
        {
            if (_cts == cts) Finished?.Invoke();
        }
    }

    /// <summary>Gera o áudio WAV de um texto com a voz atual (moderna).</summary>
    public static async Task<byte[]?> SynthesizeAsync(string text, double rate)
    {
        if (_synth == null) return null;
        var key = $"{_current?.Id}|{rate:0.00}|{text}";
        lock (Cache)
            if (Cache.TryGetValue(key, out var hit)) return hit;

        _synth.Options.SpeakingRate = rate;
        using var stream = await _synth.SynthesizeTextToStreamAsync(text);
        using var input = stream.AsStreamForRead();
        using var ms = new MemoryStream();
        await input.CopyToAsync(ms);
        var bytes = ms.ToArray();
        lock (Cache)
        {
            if (Cache.Count >= MaxCache) Cache.Clear();
            Cache[key] = bytes;
        }
        return bytes;
    }

    private static async Task SpeakSapiAsync(string text, double rate, CancellationToken token)
    {
        if (_sapiVoice == null) return;
        // SAPI: rate de -10 a 10 (0 = normal)
        int sapiRate = (int)Math.Round(Math.Clamp((rate - 1.0) * 10, -10, 10));
        SetProp(_sapiVoice, "Rate", sapiRate);
        Invoke(_sapiVoice, "Speak", text, 1 | 2);
        // espera terminar (WaitUntilDone em pequenos intervalos para poder cancelar)
        while (!token.IsCancellationRequested)
        {
            var done = Convert.ToBoolean(Invoke(_sapiVoice, "WaitUntilDone", 0));
            if (done) break;
            await Task.Delay(80, CancellationToken.None);
        }
    }

    private static string Clean(string text) => text.Replace("〜", "").Replace("～", "").Replace("___", "、").Replace("〇〇", "なになに").Trim();

    // ================== utilidades COM ==================
    private static object? Invoke(object target, string name, params object[] args) =>
        target.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, target, args);

    private static object? Get(object target, string name) =>
        target.GetType().InvokeMember(name, BindingFlags.GetProperty, null, target, null);

    private static void SetProp(object target, string name, object value)
    {
        var flags = value is int or bool or string ? BindingFlags.SetProperty : BindingFlags.PutRefDispProperty;
        target.GetType().InvokeMember(name, flags, null, target, new[] { value });
    }

    // ================== atalhos para configurações do Windows ==================
    public static void OpenSettings(string uri)
    {
        try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); }
        catch { }
    }

    public static void OpenWindowsSpeechSettings() => OpenSettings("ms-settings:regionlanguage");
}
