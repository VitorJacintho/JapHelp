using System.Drawing.Drawing2D;
using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>
/// Prática de escrita em 3 níveis, conferindo a ordem e o sentido dos traços (dados do KanjiVG):
/// Fácil — modelo com os números; Médio — modelo sem números; Difícil — quadro vazio, de memória.
/// </summary>
public class TracingForm : Form
{
    public enum Level { Easy, Medium, Hard }
    private static Level _lastLevel = Level.Easy; // lembra o nível enquanto o app está aberto

    private readonly List<(string Ch, string Label)> _items;
    private int _index;
    private Level _level;
    private bool _hinted;
    private readonly TraceCanvas _canvas;
    private readonly Label _info;
    private readonly Label _sub;
    private readonly Label _feedback;
    private readonly FlatButton[] _levelButtons;
    private readonly FlatButton _check;
    private readonly FlatButton _anim;

    public static void Open(List<string> chars, int index, Func<string, string>? describe = null)
    {
        if (chars.Count == 0) return;
        using var f = new TracingForm(chars, Math.Clamp(index, 0, chars.Count - 1), describe);
        f.ShowDialog(MainForm.Instance);
    }

    private TracingForm(List<string> units, int index, Func<string, string>? describe)
    {
        describe ??= c => Kana.IsAllKana(c) ? Kana.ToRomaji(c) : "";
        // "きゃ" vira "き" e "ゃ": cada caractere tem a sua ordem de traços
        _items = new();
        for (int k = 0; k < units.Count; k++)
        {
            var u = units[k];
            if (k == index) _index = _items.Count;
            var chars = u.Select(c => c.ToString()).ToList();
            if (chars.Count > 1 && chars.All(c => Strokes.Get(c) != null)) _items.AddRange(chars.Select(c => (c, describe(c))));
            else _items.Add((u, describe(u)));
        }
        _level = _lastLevel;

        Text = "Escrita — 書く練習";
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Theme.Background;
        ClientSize = new Size(Theme.S(660), Theme.S(800));
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        KeyPreview = true;

        var levels = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Theme.S(56), Padding = Theme.Pad(24, 10, 24, 4), BackColor = Theme.Background };
        _levelButtons = new[]
        {
            FlatButton.Secondary("Fácil", (_, _) => SetLevel(Level.Easy)),
            FlatButton.Secondary("Médio", (_, _) => SetLevel(Level.Medium)),
            FlatButton.Secondary("Difícil", (_, _) => SetLevel(Level.Hard)),
        };
        foreach (var b in _levelButtons) { b.FitWidth(Theme.S(120)); b.Margin = new Padding(0, 0, Theme.S(8), 0); levels.Controls.Add(b); }

        _info = new Label { Dock = DockStyle.Top, Height = Theme.S(40), Font = Theme.Jp(17f, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter, ForeColor = Theme.Text };
        _sub = new Label { Dock = DockStyle.Top, Height = Theme.S(22), Font = Theme.Ui(9.5f), TextAlign = ContentAlignment.TopCenter, ForeColor = Theme.Muted };
        _canvas = new TraceCanvas { Dock = DockStyle.Fill };
        _canvas.StrokeEnded += () =>
        {
            // nos níveis com modelo, confere sozinho quando a quantidade de traços fecha
            if (_canvas.Ref != null && _level != Level.Hard && _canvas.StrokeCount == _canvas.Ref.Length) Verify();
        };
        var canvasHost = new Panel { Dock = DockStyle.Fill, Padding = Theme.Pad(30, 4, 30, 4), BackColor = Theme.Background };
        canvasHost.Controls.Add(_canvas);

        _feedback = new Label
        {
            Dock = DockStyle.Bottom, Height = Theme.S(120), Font = Theme.Ui(10f), ForeColor = Theme.Text,
            Padding = Theme.Pad(28, 6, 28, 4), BackColor = Theme.Background,
        };

        var bar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = Theme.S(60), Padding = Theme.Pad(24, 8, 24, 8), BackColor = Theme.Background };
        bar.Controls.Add(FlatButton.Icon(Glyphs.Back, "Anterior (←)", (_, _) => Move(-1)));
        bar.Controls.Add(FlatButton.Icon(Glyphs.Forward, "Próximo (→)", (_, _) => Move(1)));
        bar.Controls.Add(FlatButton.Icon(Glyphs.Volume, "Ouvir", (_, _) => Speech.Speak(_items[_index].Ch)));
        bar.Controls.Add(FlatButton.Secondary("Desfazer", (_, _) => _canvas.Undo()));
        bar.Controls.Add(FlatButton.Secondary("Limpar", (_, _) => ShowChar()));
        _anim = FlatButton.Secondary("▶ Ver ordem", (_, _) => Animate());
        _check = FlatButton.Primary("✓ Conferir", (_, _) => Verify());
        bar.Controls.Add(_anim);
        bar.Controls.Add(_check);
        foreach (Control c in bar.Controls) c.Margin = new Padding(0, 0, Theme.S(8), 0);

        Controls.Add(canvasHost);
        Controls.Add(_feedback);
        Controls.Add(bar);
        Controls.Add(_sub);
        Controls.Add(_info);
        Controls.Add(levels);
        SetLevel(_level);
    }

    private void SetLevel(Level level)
    {
        _level = level;
        _lastLevel = level;
        for (int i = 0; i < _levelButtons.Length; i++)
        {
            bool on = i == (int)level;
            var b = _levelButtons[i];
            b.BaseColor = on ? Theme.Accent : Color.White;
            b.HoverColor = on ? Theme.AccentDark : Theme.IndigoSoft;
            b.ForeColor = on ? Color.White : Theme.Text;
            b.BorderColor = on ? Color.Empty : Theme.Border;
            b.Invalidate();
        }
        _canvas.Level = level;
        ShowChar();
    }

    private new void Move(int delta)
    {
        _index = (_index + delta + _items.Count) % _items.Count;
        ShowChar();
    }

    private void ShowChar()
    {
        _hinted = false;
        var (ch, label) = _items[_index];
        var refPaths = Strokes.Get(ch);
        _canvas.SetChar(ch, refPaths);
        var parts = new List<string>();
        if (label.Length > 0) parts.Add(label);
        if (refPaths != null && _level != Level.Hard) parts.Add($"{refPaths.Length} {(refPaths.Length == 1 ? "traço" : "traços")}");
        parts.Add($"{_index + 1}/{_items.Count}");
        _info.Text = ch;
        _sub.Text = string.Join("  ·  ", parts);
        if (_level == Level.Hard && label.Length > 0)
        {
            // de memória: mostra o som/significado, não o desenho
            _info.Text = label;
            _sub.Text = $"Escreva o caractere de memória  ·  {_index + 1}/{_items.Count}";
        }
        _check.Visible = _anim.Visible = refPaths != null;
        SetFeedback(refPaths == null ? "Sem dados de ordem dos traços para este caractere: trace livremente por cima do modelo."
            : _level switch
            {
                Level.Easy => "Siga os números: cada traço começa onde está o número. Clique direito também desfaz.",
                Level.Medium => "Trace por cima do modelo na ordem certa. O app confere quando você terminar.",
                _ => "Escreva de memória e clique em \"Conferir\". \"Ver ordem\" mostra a resposta (sem XP).",
            }, Theme.Muted);
        Speech.Speak(ch);
    }

    private void RevealTitle()
    {
        var (ch, label) = _items[_index];
        if (_level == Level.Hard) _info.Text = label.Length > 0 ? $"{ch}   {label}" : ch;
    }

    private void SetFeedback(string text, Color color)
    {
        _feedback.Text = text;
        _feedback.ForeColor = color;
    }

    private void Verify()
    {
        if (_canvas.Ref == null) return;
        if (_canvas.StrokeCount == 0) { SetFeedback("Desenhe primeiro. ✍️", Theme.Warning); return; }
        var r = _canvas.Check()!;
        RevealTitle();
        if (r.Ok && _level != Level.Easy && !_hinted) ProgressStore.AddXp(1);
        var (ok, text) = Strokes.Describe(r, _level == Level.Hard && !_hinted);
        SetFeedback(ok ? text : text + " Clique em \"Limpar\" e tente de novo.", ok ? Theme.Success : Theme.Error);
    }

    private void Animate()
    {
        if (_canvas.Ref == null) return;
        if (_level == Level.Hard && _canvas.Result == null) _hinted = true;
        RevealTitle();
        SetFeedback(_level == Level.Hard ? "Dica: veja a ordem e o sentido dos traços. Quando você começar a escrever, o modelo some."
            : "Observe a ordem e o sentido de cada traço. Depois é a sua vez.", Theme.Indigo);
        _canvas.Animate();
    }

    /// <summary>Ferramenta de desenvolvimento (--shots): abre a janela, desenha os traços dados, confere e salva um PNG.</summary>
    internal static void SaveTestShot(string path, List<string> chars, Level level, Func<List<List<PointF>>, List<List<PointF>>>? draw)
    {
        using var f = new TracingForm(chars, 0, null) { StartPosition = FormStartPosition.Manual, Location = new Point(40, 40), ShowInTaskbar = false };
        f.Show();
        f.SetLevel(level);
        if (draw != null && f._canvas.Ref != null)
        {
            f._canvas.TestSetStrokes(draw(f._canvas.Ref.Select(d => Strokes.PathPoints(d)).ToList()));
            f.Verify();
        }
        Application.DoEvents();
        using var bmp = new Bitmap(f.Width, f.Height);
        f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
        bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
        f.Close();
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        switch (keyData)
        {
            case Keys.Left: Move(-1); return true;
            case Keys.Right: Move(1); return true;
            case Keys.Control | Keys.Z: _canvas.Undo(); return true;
            case Keys.Enter: Verify(); return true;
            case Keys.Escape: Close(); return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}

/// <summary>Quadro de escrita: modelo do KanjiVG, traços do aluno, números da ordem e animação.</summary>
public class TraceCanvas : Control
{
    private readonly List<List<PointF>> _strokes = new(); // em unidades 0..109
    private List<PointF>? _current;
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 16 };
    private int _animStroke = -1;
    private float _animT;
    private bool _showOrder;
    private List<List<PointF>>? _refPts;
    private List<PointF>? _numbers;

    public string Character { get; private set; } = "";
    public string[]? Ref { get; private set; }
    public TracingForm.Level Level { get; set; } = TracingForm.Level.Easy;
    public Strokes.CheckResult? Result { get; private set; }
    public int StrokeCount => _strokes.Count;
    public event Action? StrokeEnded;

    public TraceCanvas()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Cursor = Cursors.Cross;
        _timer.Tick += (_, _) =>
        {
            _animT += 0.04f;
            if (_animT >= 1) { _animStroke++; _animT = 0; }
            if (_refPts == null || _animStroke >= _refPts.Count) { _timer.Stop(); _animStroke = -1; _showOrder = true; }
            Invalidate();
        };
    }

    public void SetChar(string ch, string[]? refPaths)
    {
        StopAnim();
        Character = ch;
        Ref = refPaths;
        _refPts = refPaths?.Select(d => Strokes.PathPoints(d)).ToList();
        _numbers = _refPts != null ? NumberPositions(_refPts) : null;
        Clear();
    }

    public void Clear() { StopAnim(); _strokes.Clear(); Result = null; _showOrder = false; Invalidate(); }

    internal void TestSetStrokes(List<List<PointF>> strokes) { Clear(); _strokes.AddRange(strokes); }
    public void Undo() { Result = null; if (_strokes.Count > 0) _strokes.RemoveAt(_strokes.Count - 1); Invalidate(); }

    public Strokes.CheckResult? Check()
    {
        if (Ref == null || _strokes.Count == 0) return null;
        Result = Strokes.Check(Ref, _strokes.Cast<IReadOnlyList<PointF>>().ToList());
        Invalidate();
        return Result;
    }

    public void Animate()
    {
        if (_refPts == null) return;
        _strokes.Clear();
        Result = null;
        _animStroke = 0;
        _animT = 0;
        _timer.Start();
    }

    private void StopAnim() { _timer.Stop(); _animStroke = -1; }
    private bool Animating => _animStroke >= 0;

    /// <summary>Números logo antes do começo de cada traço, no sentido contrário, sem se sobrepor.</summary>
    private static List<PointF> NumberPositions(List<List<PointF>> pts)
    {
        const float r = 4.8f;
        var placed = new List<PointF>();
        foreach (var p in pts)
        {
            var a = p[0];
            var b = p[Math.Min(4, p.Count - 1)];
            float vx = b.X - a.X, vy = b.Y - a.Y;
            float len = MathF.Sqrt(vx * vx + vy * vy);
            if (len == 0) { vx = 0; vy = 1; } else { vx /= len; vy /= len; }
            PointF? best = null;
            foreach (var side in new[] { 0, 1, -1, 2, -2, 3, -3 })
            {
                float x = Math.Clamp(a.X - vx * 6.5f - vy * side * 7, r + 1, Strokes.Box - r - 1);
                float y = Math.Clamp(a.Y - vy * 6.5f + vx * side * 7, r + 1, Strokes.Box - r - 1);
                bool clash = placed.Any(q => MathF.Sqrt((q.X - x) * (q.X - x) + (q.Y - y) * (q.Y - y)) < 2 * r + 0.8f);
                if (!clash) { best = new PointF(x, y); break; }
                best ??= new PointF(x, y);
            }
            placed.Add(best!.Value);
        }
        return placed;
    }

    private Rectangle Square
    {
        get
        {
            int s = Math.Min(Width, Height) - 2;
            return new Rectangle((Width - s) / 2, (Height - s) / 2, s, s);
        }
    }

    private PointF ToUnits(Point p)
    {
        var sq = Square;
        return new PointF((p.X - sq.Left) * Strokes.Box / sq.Width, (p.Y - sq.Top) * Strokes.Box / sq.Height);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Right) { Undo(); return; }
        if (e.Button != MouseButtons.Left) return;
        StopAnim();
        _showOrder = false;
        if (Result != null) { _strokes.Clear(); Result = null; } // nova tentativa depois de conferir
        _current = new List<PointF> { ToUnits(e.Location) };
        _strokes.Add(_current);
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        if (_current == null || e.Button != MouseButtons.Left) return;
        var p = ToUnits(e.Location);
        var last = _current[^1];
        if (MathF.Abs(p.X - last.X) + MathF.Abs(p.Y - last.Y) < 0.6f) return;
        _current.Add(p);
        Invalidate();
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        if (_current == null) return;
        _current = null;
        StrokeEnded?.Invoke();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _timer.Dispose();
        base.Dispose(disposing);
    }

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

        var state = g.Save();
        g.TranslateTransform(sq.Left, sq.Top);
        float s = sq.Width / Strokes.Box;
        g.ScaleTransform(s, s); // daqui em diante: unidades do KanjiVG (0..109)

        bool reveal = Result != null || Animating || _showOrder;
        if (_refPts != null)
        {
            if (Level != TracingForm.Level.Hard || reveal)
                using (var guide = RoundPen(Color.FromArgb(222, 222, 228), 4.2f))
                    foreach (var p in _refPts) DrawLine(g, guide, p, 1);
            if (Animating)
                using (var ap = RoundPen(Theme.Accent, 4.2f))
                {
                    for (int k = 0; k < _animStroke && k < _refPts.Count; k++) DrawLine(g, ap, _refPts[k], 1);
                    if (_animStroke < _refPts.Count) DrawLine(g, ap, _refPts[_animStroke], _animT);
                }
        }
        else if (Character.Length > 0 && Level != TracingForm.Level.Hard)
        {
            g.Restore(state);
            state = g.Save();
            float px = sq.Height * 0.62f / (Character.Length > 1 ? 1.7f : 1f);
            using var font = new Font(Theme.JpTraceFamily, px, FontStyle.Regular, GraphicsUnit.Pixel);
            using var brush = new SolidBrush(Color.FromArgb(222, 222, 228));
            var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString(Character, font, brush, sq, fmt);
            g.TranslateTransform(sq.Left, sq.Top);
            g.ScaleTransform(s, s);
        }

        // traços do aluno (verde = certo, vermelho = errado depois de conferir)
        float width = Math.Max(3.2f, 6f / s);
        for (int k = 0; k < _strokes.Count; k++)
        {
            var color = Result == null ? Color.FromArgb(30, 30, 40) : Result.Results.ElementAtOrDefault(k)?.Ok == true ? Theme.Success : Theme.Error;
            using var pen = RoundPen(color, width);
            var st = _strokes[k];
            if (st.Count == 1)
                using (var br = new SolidBrush(color)) g.FillEllipse(br, st[0].X - width / 2, st[0].Y - width / 2, width, width);
            else DrawLine(g, pen, st, 1);
        }

        // números por cima de tudo
        if (_numbers != null && _refPts != null)
        {
            int count = Animating ? Math.Min(_animStroke + 1, _numbers.Count)
                : Level == TracingForm.Level.Easy || Result != null || _showOrder ? _numbers.Count : 0;
            var bg = Result != null ? Theme.Indigo : Theme.Accent;
            using var nb = new SolidBrush(bg);
            using var nf = new Font("Segoe UI", 5.6f, FontStyle.Bold, GraphicsUnit.Pixel);
            var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            for (int k = 0; k < count; k++)
            {
                var c = _numbers[k];
                g.FillEllipse(nb, c.X - 4.6f, c.Y - 4.6f, 9.2f, 9.2f);
                g.DrawString((k + 1).ToString(), nf, Brushes.White, new RectangleF(c.X - 5, c.Y - 5, 10, 10.4f), fmt);
            }
        }
        g.Restore(state);
    }

    private static Pen RoundPen(Color c, float w) => new(c, w) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };

    private static void DrawLine(Graphics g, Pen pen, List<PointF> pts, float upto)
    {
        int n = Math.Max(1, (int)Math.Round(pts.Count * upto));
        if (n < 2) return;
        g.DrawLines(pen, pts.Take(n).ToArray());
    }
}
