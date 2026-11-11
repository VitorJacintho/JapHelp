using JapHelp.Core;
using JapHelp.UI;

namespace JapHelp;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length >= 1 && args[0] == "--selftest")
            return SelfTest.Run(args.Length >= 2 ? args[1] : Path.Combine(AppContext.BaseDirectory, "selftest.txt"));
        if (args.Length >= 2 && args[0] == "--paridade")
            return Paridade.Run(args[1]);

        ApplicationConfiguration.Initialize();
        using (var g = Graphics.FromHwnd(IntPtr.Zero))
            Theme.Scale = Math.Max(1f, g.DpiX / 96f);

        bool shots = args.Length >= 2 && args[0] == "--shots";
        Application.ThreadException += (_, e) =>
        {
            if (shots)
                File.AppendAllText(Path.Combine(args[1], "thread_errors.txt"), e.Exception + "\n\n");
            else
                MessageBox.Show("Ocorreu um erro inesperado:\n\n" + e.Exception.Message, "JapHelp", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        };

        if (args.Length >= 2 && args[0] == "--shots")
            ProgressStore.OverrideFolder = Path.Combine(args[1], "progress");
        ProgressStore.Load();
        ContentRepository.Load();
        Speech.Init(ProgressStore.Data.Settings.VoiceId);

        var form = new MainForm();
        if (args.Length >= 2 && args[0] == "--shots")
        {
            form.TopMost = true;
            ScreenshotTour.Run(form, args[1]);
        }
        Application.Run(form);
        return 0;
    }
}
