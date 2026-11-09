using JapHelp.Core;

namespace JapHelp.UI.Views;

public class CourseView : UserControl
{
    public CourseView()
    {
        BackColor = Theme.Background;
        var stack = new StackPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(36, 28, 36, 28), MaxContentWidth = Theme.S(1100), Spacing = 10 };
        Controls.Add(stack);

        stack.Add(Ui.Title("Curso de japonês"));
        stack.Add(Ui.Subtitle("Siga os níveis em ordem. Cada lição tem teoria, vocabulário, exemplos com áudio e exercícios. Faça 70% ou mais para concluir."));

        foreach (var m in ContentRepository.Modules)
        {
            var color = Theme.FromHex(m.Color, Theme.Accent);
            int done = m.Lessons.Count(l => ProgressStore.IsCompleted(l.Id));
            stack.Add(Ui.Spacer(6));
            var header = Ui.Label($"{m.Title}", Theme.Ui(16f, FontStyle.Bold), color, new Padding(0, Theme.S(8), 0, 0));
            stack.Add(header);
            var meta = string.IsNullOrWhiteSpace(m.Level) ? "" : m.Level + "  ·  ";
            stack.Add(Ui.Label($"{meta}{done}/{m.Lessons.Count} concluídas  ·  {m.Description}", Theme.Ui(10.5f), Theme.Muted));
            stack.Add(new ProgressLine { Value = m.Lessons.Count == 0 ? 0 : (float)done / m.Lessons.Count, BarColor = color, Height = Theme.S(6) });

            var flow = new FlowLayoutPanel { AutoSize = true, WrapContents = true, BackColor = Color.Transparent, Margin = new Padding(0, Theme.S(6), 0, 0) };
            foreach (var l in m.Lessons)
            {
                var card = new LessonCard(l);
                card.Click += (_, _) => MainForm.Instance.OpenLesson(l);
                flow.Controls.Add(card);
            }
            stack.Add(flow);
        }

        if (ContentRepository.Modules.Count == 0)
            stack.Add(new InfoBox("Nenhum conteúdo encontrado. Verifique a pasta Content ao lado do JapHelp.exe.", Theme.Ui(11f), Theme.Error, Theme.ErrorSoft));
    }
}
