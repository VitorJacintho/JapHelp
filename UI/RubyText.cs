using JapHelp.Core;

namespace JapHelp.UI;

/// <summary>
/// Texto japonês com furigana em cima dos kanji, medido e desenhado à mão (WinForms não tem &lt;ruby&gt;).
/// Build devolve null quando não há kanji com leitura — aí o controle mostra o texto como antes.
/// </summary>
public sealed class RubyLayout
{
    private sealed record Unit(string Text, string? Rt, int X, int Line, int W);

    private const TextFormatFlags Flags = TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine;
    private readonly List<Unit> _units = new();
    private readonly Font _jp;
    private readonly Font _rt;
    private readonly int _jpH;
    private readonly int _rtH;
    public int Height { get; private set; }
    public int Width { get; private set; }

    private RubyLayout(Font jp, Font rt)
    {
        _jp = jp;
        _rt = rt;
        _jpH = TextRenderer.MeasureText("日", jp, Size.Empty, Flags).Height;
        _rtH = TextRenderer.MeasureText("に", rt, Size.Empty, Flags).Height;
    }

    /// <summary>Fonte da furigana proporcional ao texto (metade do tamanho).</summary>
    public static Font RubyFontFor(Font jp) => Theme.Jp(Math.Max(7.5f, jp.Size * 0.55f));

    public static RubyLayout? Build(string jp, string? reading, Font jpFont, int maxWidth, bool wrap = true)
    {
        if (string.IsNullOrEmpty(reading) || !Kana.ContainsKanji(jp)) return null;
        var parts = Furigana.Align(jp, reading);
        if (parts == null || parts.All(p => p.Reading == null)) return null;
        var layout = new RubyLayout(jpFont, RubyFontFor(jpFont));
        // peças: trecho com furigana não se divide; o resto quebra letra por letra
        var pieces = new List<(string Text, string? Rt)>();
        foreach (var p in parts)
        {
            if (p.Reading != null) pieces.Add((p.Text, p.Reading));
            else foreach (var c in p.Text) pieces.Add((c.ToString(), null));
        }
        int x = 0, line = 0, maxX = 0;
        foreach (var (text, rt) in pieces)
        {
            int w = TextRenderer.MeasureText(text, jpFont, Size.Empty, Flags).Width;
            if (rt != null) w = Math.Max(w, TextRenderer.MeasureText(rt, layout._rt, Size.Empty, Flags).Width);
            if (wrap && x > 0 && x + w > maxWidth) { line++; x = 0; }
            layout._units.Add(new Unit(text, rt, x, line, w));
            x += w;
            maxX = Math.Max(maxX, x);
        }
        layout.Height = (line + 1) * (layout._jpH + layout._rtH);
        layout.Width = maxX;
        return layout;
    }

    public void Draw(Graphics g, int left, int top, Color text, Color ruby)
    {
        int lineH = _jpH + _rtH;
        foreach (var u in _units)
        {
            int y = top + u.Line * lineH;
            if (u.Rt != null)
                TextRenderer.DrawText(g, u.Rt, _rt, new Rectangle(left + u.X, y, u.W, _rtH), ruby, Flags | TextFormatFlags.HorizontalCenter);
            TextRenderer.DrawText(g, u.Text, _jp, new Rectangle(left + u.X, y + _rtH, u.W, _jpH), text, Flags | TextFormatFlags.HorizontalCenter);
        }
    }
}

/// <summary>Rótulo com furigana (usado no lugar do Label de japonês quando há leitura).</summary>
public class RubyLabel : Control
{
    private readonly string _jp;
    private readonly string _reading;
    private RubyLayout? _layout;

    public RubyLabel(string jp, string reading, Font font)
    {
        _jp = jp;
        _reading = reading;
        Font = font;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
    }

    /// <summary>true se a leitura encaixou nos kanji (senão quem usa mostra a leitura numa linha separada).</summary>
    public bool Works => RubyLayout.Build(_jp, _reading, Font, 10_000) != null;

    public int HeightForWidth(int width)
    {
        _layout = RubyLayout.Build(_jp, _reading, Font, Math.Max(40, width));
        return _layout?.Height ?? TextRenderer.MeasureText(_jp, Font, new Size(width, 0), TextFormatFlags.WordBreak).Height;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        _layout ??= RubyLayout.Build(_jp, _reading, Font, Math.Max(40, Width));
        if (_layout != null) _layout.Draw(e.Graphics, 0, 0, ForeColor, Theme.Muted);
        else TextRenderer.DrawText(e.Graphics, _jp, Font, ClientRectangle, ForeColor, TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
    }

    protected override void OnResize(EventArgs e)
    {
        _layout = null;
        base.OnResize(e);
    }
}
