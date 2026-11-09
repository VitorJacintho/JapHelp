using JapHelp.Core;
using JapHelp.UI.Views;

namespace JapHelp.UI;

/// <summary>Ferramenta de desenvolvimento: abre cada tela e salva um PNG (JapHelp.exe --shots pasta).</summary>
public static class ScreenshotTour
{
    private static ExerciseRunner? _runner;

    public static void Run(MainForm form, string dir)
    {
        Directory.CreateDirectory(dir);
        var lesson = ContentRepository.FindLesson("n2-06") ?? ContentRepository.AllLessons.First();
        var kanaLesson = ContentRepository.FindLesson("n0-02") ?? lesson;
        var lifeLesson = ContentRepository.FindLesson("n6-03") ?? lesson;
        var steps = new List<(string name, Action show)>
        {
            ("01_home", () => form.Navigate("home")),
            ("02_course", () => form.Navigate("course")),
            ("03_lesson_theory", () => form.OpenLesson(lesson, "theory")),
            ("04_lesson_vocab_kana", () => form.OpenLesson(kanaLesson, "vocab")),
            ("05_lesson_examples", () => form.OpenLesson(lesson, "examples")),
            ("06_lesson_dialog", () => form.OpenLesson(lifeLesson, "dialog")),
            ("07_lesson_exercises", () => form.OpenLesson(lesson, "exercises")),
            ("08_runner_choice", () => form.RunExercises("t", () => ExerciseFactory.ForLesson(lifeLesson).Where(e => e.Type == ExType.Choice && e.Context != null).Take(3).ToList(), null, () => { }, "course")),
            ("09_runner_order", () => form.RunExercises("t", () => ExerciseFactory.ForLesson(lesson).Where(e => e.Type == ExType.Order).Take(2).ToList(), null, () => { }, "course")),
            ("10_runner_typing", () => form.RunExercises("t", () => ExerciseFactory.ForLesson(kanaLesson).Where(e => e.Type == ExType.Typing).Take(2).ToList(), null, () => { }, "course")),
            ("11_kana", () => form.Navigate("kana")),
            ("12_kanji", () => form.Navigate("kanji")),
            ("13_review", () =>
            {
                foreach (var v in ContentRepository.FindLesson("n1-01")!.VocabItems) ProgressStore.AddToSrs(v);
                form.Navigate("review");
            }),
            ("13b_review_card", () =>
            {
                var rv = new ReviewView();
                form.ShowView(rv, "review");
                rv.StartSession(false);
            }),
            ("14_phrases", () => form.Navigate("phrases")),
            ("15_dict", () => form.Navigate("dict")),
            ("16_settings", () => form.Navigate("settings")),
            ("17_feedback_wrong", () =>
            {
                var all = ExerciseFactory.ForLesson(lesson);
                var pick = new List<Exercise>
                {
                    all.First(e => e.Type == ExType.Choice),
                    all.First(e => e.Type == ExType.Typing),
                    all.First(e => e.Type == ExType.Order),
                };
                _runner = new ExerciseRunner("teste", () => pick, r => $"+{r.Correct * 2} XP · teste", () => { }) ;
                form.ShowView(_runner, "course");
                _runner.TestAnswer(false);
            }),
            ("18_feedback_typing_ok", () => _runner!.TestAnswer(true)),
            ("19_feedback_order_ok", () => _runner!.TestAnswer(true)),
            ("20_finish", () => _runner!.TestFinishAll()),
        };
        int i = 0;
        var timer = new System.Windows.Forms.Timer { Interval = 700 };
        bool captured = true;
        timer.Tick += (_, _) =>
        {
            if (!captured)
            {
                Capture(form, Path.Combine(dir, steps[i].name + ".png"));
                captured = true;
                i++;
                return;
            }
            if (i >= steps.Count)
            {
                timer.Stop();
                form.Close();
                return;
            }
            try { steps[i].show(); }
            catch (Exception ex) { File.WriteAllText(Path.Combine(dir, steps[i].name + ".error.txt"), ex.ToString()); }
            captured = false;
        };
        form.Shown += (_, _) => timer.Start();
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);

    private static void Capture(Form form, string path)
    {
        var b = form.Bounds;
        using var bmp = new Bitmap(b.Width, b.Height);
        if (path.Contains("theory"))
        {
            // RichTextBox não suporta DrawToBitmap: usa PrintWindow
            using var g = Graphics.FromImage(bmp);
            var hdc = g.GetHdc();
            try { PrintWindow(form.Handle, hdc, 2 /* PW_RENDERFULLCONTENT */); }
            finally { g.ReleaseHdc(hdc); }
        }
        else
        {
            form.DrawToBitmap(bmp, new Rectangle(0, 0, b.Width, b.Height));
        }
        bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
    }
}
