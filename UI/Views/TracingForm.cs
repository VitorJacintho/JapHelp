using System.Drawing.Drawing2D;
using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Janela para praticar a escrita traçando por cima do caractere.</summary>
public class TracingForm : Form
{
    private readonly List<string> _chars;
    private int _index;
    private readonly TraceCanvas _canvas;
    private readonly Label _info;

    public static void Open(List<string> chars, int index, Func<string, string>? describe = null)
    {
        if (chars.Count == 0) return;
        using var f = new TracingForm(chars, Math.Clamp(index, 0, chars.Count - 1), describe);
        f.ShowDialog(MainForm.Instance);
    }

    private readonly Func<string, string> _describe;

    private TracingForm(List<string> chars, int index, Func<string, string>? describe)
    {
        _chars = chars;
        _index = index;
        _describe = describe ?? (c => Kana.IsAllKana(c) ? Kana.ToRomaji(c) : "");
        Text = "Prática de escrita — 書く練習";
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Theme.Background;
        ClientSize = new Size(Theme.S(560), Theme.S(700));
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        KeyPreview = true;

        _info = new Label { Dock = DockStyle.Top, Height = Theme.S(48), Font = Theme.Jp(15f, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter, ForeColor = Theme.Text };
        _canvas = new TraceCanvas { Dock = DockStyle.Fill, Margin = Theme.Pad(20) };
        var canvasHost = new Panel { Dock = DockStyle.Fill, Padding = Theme.Pad(30, 6, 30, 6), BackColor = Theme.Background };
        canvasHost.Controls.Add(_canvas);

        var tip = new Label
        {
            Dock = DockStyle.Bottom,
            Height = Theme.S(58),
            Font = Theme.Ui(9.5f),
            ForeColor = Theme.Muted,
            Padding = Theme.Pad(24, 4, 24, 4),
            Text = "Regras gerais de traço: de cima para baixo, da esquerda para a direita; horizontais antes de verticais; " +
                   "o traço que atravessa tudo costuma vir por último. Escreva cada caractere 5 vezes dizendo o som em voz alta.",
        };

        var bar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = Theme.S(60), Padding = Theme.Pad(24, 8, 24, 8), BackColor = Theme.Background };
        bar.Controls.Add(FlatButton.Icon(Glyphs.Back, "Anterior (←)", (_, _) => Move(-1)));
        bar.Controls.Add(FlatButton.Icon(Glyphs.Forward, "Próximo (→)", (_, _) => Move(1)));
        bar.Controls.Add(FlatButton.Icon(Glyphs.Volume, "Ouvir", (_, _) => Speech.Speak(_chars[_index])));
        bar.Controls.Add(FlatButton.Secondary("Desfazer", (_, _) => _canvas.Undo()));
        bar.Controls.Add(FlatButton.Secondary("Limpar", (_, _) => _canvas.Clear()));
        var guide = FlatButton.Secondary("Ocultar modelo", null);
        guide.Click += (_, _) =>
        {
            _canvas.ShowGuide = !_canvas.ShowGuide;
            guide.Text = _canvas.ShowGuide ? "Ocultar modelo" : "Mostrar modelo";
            _canvas.Invalidate();
        };
        guide.FitWidth();
        bar.Controls.Add(guide);
        foreach (Control c in bar.Controls) c.Margin = new Padding(0, 0, Theme.S(8), 0);

        Controls.Add(canvasHost);
        Controls.Add(bar);
        Controls.Add(tip);
        Controls.Add(_info);
        ShowChar();
    }

    private new void Move(int delta)
    {
        _index = (_index + delta + _chars.Count) % _chars.Count;
        ShowChar();
    }

    private void ShowChar()
    {
        var c = _chars[_index];
        var desc = _describe(c);
        _info.Text = $"{c}   {desc}   ({_index + 1}/{_chars.Count})";
        _canvas.Character = c;
        _canvas.Clear();
        Speech.Speak(c);
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        switch (keyData)
        {
            case Keys.Left: Move(-1); return true;
            case Keys.Right: Move(1); return true;
            case Keys.Control | Keys.Z: _canvas.Undo(); return true;
            case Keys.Escape: Close(); return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}

public class TraceCanvas : Control
{
    private readonly List<List<Point>> _strokes = new();
    private List<Point>? _current;
    public string Character { get; set; } = "";
    public bool ShowGuide { get; set; } = true;

    public TraceCanvas()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Cursor = Cursors.Cross;
    }

    public void Clear() { _strokes.Clear(); Invalidate(); }
    public void Undo() { if (_strokes.Count > 0) _strokes.RemoveAt(_strokes.Count - 1); Invalidate(); }

    private Rectangle Square
    {
        get
        {
            int s = Math.Min(Width, Height) - 2;
            return new Rectangle((Width - s) / 2, (Height - s) / 2, s, s);
        }
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        _current = new List<Point> { e.Location };
        _strokes.Add(_current);
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        if (_current == null || e.Button != MouseButtons.Left) return;
        _current.Add(e.Location);
        Invalidate();
    }

    protected override void OnMouseUp(MouseEventArgs e) => _current = null;

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        g.Clear(Theme.Background);
        var sq = Square;
        using (var b = new SolidBrush(Color.White)) g.FillRectangle(b, sq);
        using (var border = new Pen(Theme.Border, 2)) g.DrawRectangle(border, sq);
        using (var dash = new Pen(Color.FromArgb(225, 205, 205), 1) { DashStyle = DashStyle.Dash })
        {
            g.DrawLine(dash, sq.Left, sq.Top + sq.Height / 2, sq.Right, sq.Top + sq.Height / 2);
            g.DrawLine(dash, sq.Left + sq.Width / 2, sq.Top, sq.Left + sq.Width / 2, sq.Bottom);
        }
        if (ShowGuide && Character.Length > 0)
        {
            float px = sq.Height * 0.62f / (Character.Length > 1 ? 1.7f : 1f);
            using var font = new Font(Theme.JpTraceFamily, px, FontStyle.Regular, GraphicsUnit.Pixel);
            using var brush = new SolidBrush(Color.FromArgb(222, 222, 228));
            var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString(Character, font, brush, sq, fmt);
        }
        using var pen = new Pen(Color.FromArgb(30, 30, 40), Math.Max(6f, sq.Width / 36f)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        foreach (var s in _strokes)
        {
            if (s.Count == 1) g.FillEllipse(Brushes.Black, s[0].X - 3, s[0].Y - 3, 6, 6);
            else if (s.Count > 1) g.DrawLines(pen, s.ToArray());
        }
    }
}
