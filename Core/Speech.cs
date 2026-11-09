using System.Diagnostics;
using System.Reflection;

namespace JapHelp.Core;

/// <summary>
/// Síntese de voz em japonês via SAPI (COM), sem dependências externas.
/// Procura vozes japonesas "Desktop" (SAPI) e também as vozes modernas (OneCore: Haruka, Ayumi, Ichiro).
/// </summary>
public static class Speech
{
    private static object? _voice;
    private static bool _initialized;

    public static bool Available { get; private set; }
    public static string VoiceName { get; private set; } = "";
    public static int Rate { get; set; } = -1;

    public static void Init()
    {
        if (_initialized) return;
        _initialized = true;
        try
        {
            var voiceType = Type.GetTypeFromProgID("SAPI.SpVoice");
            if (voiceType == null) return;
            _voice = Activator.CreateInstance(voiceType);
            if (_voice == null) return;

            // 1) Vozes SAPI clássicas
            var tokens = Invoke(_voice, "GetVoices", "Language=411", "");
            if (TryPick(tokens)) return;

            // 2) Vozes OneCore (instaladas pelo pacote de fala do Windows 10/11)
            foreach (var path in new[]
            {
                @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech_OneCore\Voices",
                @"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Speech_OneCore\Voices",
            })
            {
                try
                {
                    var catType = Type.GetTypeFromProgID("SAPI.SpObjectTokenCategory");
                    if (catType == null) break;
                    var cat = Activator.CreateInstance(catType)!;
                    Invoke(cat, "SetId", path, false);
                    var toks = Invoke(cat, "EnumerateTokens", "Language=411", "");
                    if (TryPick(toks)) return;
                }
                catch
                {
                    // categoria pode não existir
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("Speech init failed: " + ex.Message);
        }
    }

    private static bool TryPick(object? tokens)
    {
        if (tokens == null) return false;
        var count = Convert.ToInt32(Get(tokens, "Count"));
        if (count <= 0) return false;
        var token = Invoke(tokens, "Item", 0)!;
        SetProp(_voice!, "Voice", token);
        try { VoiceName = Convert.ToString(Invoke(token, "GetDescription", 0)) ?? "Japonês"; }
        catch { VoiceName = "Japonês"; }
        Available = true;
        return true;
    }

    /// <summary>Fala o texto (interrompe o que estiver falando).</summary>
    public static void Speak(string? text, bool slow = false)
    {
        if (!Available || _voice == null || string.IsNullOrWhiteSpace(text)) return;
        try
        {
            SetProp(_voice, "Rate", slow ? Math.Min(Rate, -1) - 4 : Rate);
            Invoke(_voice, "Speak", Clean(text), 1 | 2); // SVSFlagsAsync | SVSFPurgeBeforeSpeak
        }
        catch (Exception ex)
        {
            Debug.WriteLine("Speak failed: " + ex.Message);
        }
    }

    /// <summary>Enfileira várias falas (ex.: diálogo inteiro).</summary>
    public static void SpeakQueue(IEnumerable<string> lines)
    {
        if (!Available || _voice == null) return;
        try
        {
            SetProp(_voice, "Rate", Rate);
            bool first = true;
            foreach (var l in lines)
            {
                Invoke(_voice, "Speak", Clean(l), first ? (1 | 2) : 1);
                first = false;
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("SpeakQueue failed: " + ex.Message);
        }
    }

    public static void Stop()
    {
        if (!Available || _voice == null) return;
        try { Invoke(_voice, "Speak", "", 1 | 2); } catch { }
    }

    private static string Clean(string text) => text.Replace("〜", "").Replace("～", "").Replace("___", "、");

    private static object? Invoke(object target, string name, params object[] args) =>
        target.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, target, args);

    private static object? Get(object target, string name) =>
        target.GetType().InvokeMember(name, BindingFlags.GetProperty, null, target, null);

    private static void SetProp(object target, string name, object value)
    {
        var flags = value is int or bool or string ? BindingFlags.SetProperty : BindingFlags.PutRefDispProperty;
        target.GetType().InvokeMember(name, flags, null, target, new[] { value });
    }

    public static void OpenWindowsSpeechSettings()
    {
        try { Process.Start(new ProcessStartInfo("ms-settings:speech") { UseShellExecute = true }); }
        catch { }
    }
}
