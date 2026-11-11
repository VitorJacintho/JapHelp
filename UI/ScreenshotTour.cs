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
            ("02b_course_scrolled", () =>
            {
                // simula a roda do mouse sobre um cartão de lição
                var stack = FindAll<StackPanel>(form).First(s => s.Visible);
                var card = FindAll<LessonCard>(stack).First();
                var pt = card.PointToScreen(new Point(20, 20));
                for (int k = 0; k < 6; k++)
                    SendMessage(card.Handle, 0x020A, (IntPtr)((-120) << 16), (IntPtr)((pt.Y << 16) | (pt.X & 0xFFFF)));
                File.WriteAllText(Path.Combine(dir, "scroll_check.log"),
                    $"barra visível={stack.VerticalScroll.Visible} posição={-stack.AutoScrollPosition.Y} altura conteúdo={stack.AutoScrollMinSize.Height} altura janela={stack.ClientSize.Height}");
            }),
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
            ("21_vocab", () => form.Navigate("vocab")),
            ("22_speak", () => form.Navigate("speak")),
            ("23_reading_text", () => form.OpenLesson(ContentRepository.FindLesson("n7-02")!, "text")),
            ("24_reading_exercise", () =>
            {
                var l = ContentRepository.FindLesson("n7-02")!;
                var pick = ExerciseFactory.ForLesson(l).Where(e => e.Passage != null).Take(2).ToList();
                form.RunExercises("leitura", () => pick, null, () => { }, "course");
            }),
            ("25_kanji_n3", () => form.ShowView(new KanjiView("N3"), "kanji")),
            ("26_n2_lesson", () => form.OpenLesson(ContentRepository.FindLesson("n5-09")!, "theory")),
            ("27_vocab_furigana", () => form.OpenLesson(lesson, "vocab")),
            ("28_trace", () =>
            {
                TracingForm.SaveTestShot(Path.Combine(dir, "28a_trace_facil.png"), new() { "日", "本" }, TracingForm.Level.Easy, null);
                TracingForm.SaveTestShot(Path.Combine(dir, "28b_trace_certo.png"), new() { "日" }, TracingForm.Level.Medium, s => s);
                // 本 de memória, menor, com 1º e 2º trocados e o 3º invertido
                TracingForm.SaveTestShot(Path.Combine(dir, "28c_trace_errado.png"), new() { "本" }, TracingForm.Level.Hard, s =>
                {
                    var small = s.Select(st => st.Select(p => new PointF(12 + p.X * 0.6f, 20 + p.Y * 0.6f)).ToList()).ToList();
                    return new[] { small[1], small[0], Enumerable.Reverse(small[2]).ToList() }.Concat(small.Skip(3)).ToList();
                });
            }),
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
    private static extern IntPtr SendMessage(IntPtr hwnd, int msg, IntPtr wp, IntPtr lp);

    private static IEnumerable<T> FindAll<T>(Control root) where T : Control
    {
        foreach (Control c in root.Controls)
        {
            if (c is T t) yield return t;
            foreach (var x in FindAll<T>(c)) yield return x;
        }
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
