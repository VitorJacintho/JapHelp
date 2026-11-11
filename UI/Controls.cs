using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using JapHelp.Core;

namespace JapHelp.UI;

/// <summary>Controles que sabem calcular a própria altura para uma largura (usado pelo StackPanel).</summary>
public interface IFlexHeight
{
    int HeightForWidth(int width);
}

public static class Glyphs
{
    public const string Volume = "";
    public const string Back = "";
    public const string Forward = "";
    public const string Close = "";
    public const string Check = "";
    public const string Pen = "";
    public const string Refresh = "";
    public const string Search = "";
    public const string Play = "";
    public const string Lightbulb = "";
    public const string Delete = "";
    public const string Star = "";
    public const string Font = "Segoe MDL2 Assets";
}

// =====================================================================
// Botão plano com cantos arredondados
// =====================================================================
public class FlatButton : Control
{
    private bool _hover, _press;
    public Color BaseColor { get; set; } = Theme.Accent;
    public Color HoverColor { get; set; } = Theme.AccentDark;
    public Color BorderColor { get; set; } = Color.Empty;
    public int Radius { get; set; } = 8;
    public string? Glyph { get; set; }
    public ContentAlignment TextAlign { get; set; } = ContentAlignment.MiddleCenter;
    public Padding TextPadding { get; set; } = new(14, 6, 14, 6);
    public string? SubText { get; set; }

    public FlatButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer |
                 ControlStyles.ResizeRedraw | ControlStyles.Selectable | ControlStyles.SupportsTransparentBackColor, true);
        Cursor = Cursors.Hand;
        ForeColor = Color.White;
        Font = Theme.UiSemi(10.5f);
        Size = new Size(Theme.S(140), Theme.S(40));
        TabStop = true;
    }

    public static FlatButton Primary(string text, EventHandler? onClick = null)
    {
        var b = new FlatButton { Text = text };
        if (onClick != null) b.Click += onClick;
        b.FitWidth();
        return b;
    }

    public static FlatButton Secondary(string text, EventHandler? onClick = null)
    {
        var b = new FlatButton
        {
            Text = text,
            BaseColor = Color.White,
            HoverColor = Theme.IndigoSoft,
            ForeColor = Theme.Text,
            BorderColor = Theme.Border,
        };
        if (onClick != null) b.Click += onClick;
        b.FitWidth();
        return b;
    }

    public static FlatButton Icon(string glyph, string tooltip, EventHandler? onClick = null, Color? color = null)
    {
        var b = new FlatButton
        {
            Glyph = glyph,
            BaseColor = color ?? Theme.IndigoSoft,
            HoverColor = Theme.Blend(color ?? Theme.IndigoSoft, Color.Black, 0.08f),
            ForeColor = color.HasValue ? Color.White : Theme.Indigo,
            Size = new Size(Theme.S(40), Theme.S(40)),
            Radius = 20,
        };
        if (onClick != null) b.Click += onClick;
        new ToolTip().SetToolTip(b, tooltip);
        return b;
    }

    public void FitWidth(int min = 0)
    {
        var sz = TextRenderer.MeasureText(Text, Font);
        int glyphW = Glyph != null ? Theme.S(26) : 0;
        Width = Math.Max(min, sz.Width + Theme.S(TextPadding.Horizontal) + glyphW + Theme.S(6));
        Height = Math.Max(Height, sz.Height + Theme.S(TextPadding.Vertical) + Theme.S(8));
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; _press = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { _press = true; Invalidate(); base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { _press = false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
    protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }

    protected override bool IsInputKey(Keys keyData) => keyData is Keys.Enter or Keys.Space || base.IsInputKey(keyData);

    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            OnClick(EventArgs.Empty);
            e.Handled = true;
        }
        base.OnKeyDown(e);
    }

    public void PerformClick() => OnClick(EventArgs.Empty);

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var color = !Enabled ? Theme.Blend(BaseColor, Color.LightGray, 0.6f) : _press ? Theme.Blend(HoverColor, Color.Black, 0.1f) : _hover ? HoverColor : BaseColor;
        var rect = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
        using (var path = Theme.RoundRect(rect, Theme.S(Radius)))
        {
            using var brush = new SolidBrush(color);
            g.FillPath(brush, path);
            if (BorderColor != Color.Empty)
            {
                using var pen = new Pen(Focused ? Theme.Indigo : BorderColor, Focused ? 2f : 1f);
                g.DrawPath(pen, path);
            }
            else if (Focused && ShowFocusCues)
            {
                using var pen = new Pen(Color.FromArgb(120, Color.White), 2f);
                g.DrawPath(pen, path);
            }
        }

        var fore = Enabled ? ForeColor : Theme.Muted;
        var inner = new Rectangle(Theme.S(TextPadding.Left), 0, Width - Theme.S(TextPadding.Horizontal), Height);
        if (Glyph != null)
        {
            var gf = Theme.Get(Glyphs.Font, string.IsNullOrEmpty(Text) ? 13f : 11f, FontStyle.Regular);
            if (string.IsNullOrEmpty(Text))
            {
                TextRenderer.DrawText(g, Glyph, gf, ClientRectangle, fore, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }
            var gr = new Rectangle(inner.X, 0, Theme.S(24), Height);
            TextRenderer.DrawText(g, Glyph, gf, gr, fore, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            inner = new Rectangle(inner.X + Theme.S(26), 0, inner.Width - Theme.S(26), Height);
        }

        var flags = TextFormatFlags.WordBreak | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix;
        flags |= TextAlign switch
        {
            ContentAlignment.MiddleLeft or ContentAlignment.TopLeft or ContentAlignment.BottomLeft => TextFormatFlags.Left,
            ContentAlignment.MiddleRight or ContentAlignment.TopRight or ContentAlignment.BottomRight => TextFormatFlags.Right,
            _ => TextFormatFlags.HorizontalCenter
        };
        if (SubText != null)
        {
            var top = new Rectangle(inner.X, inner.Y + Theme.S(6), inner.Width, Height / 2);
            var bottom = new Rectangle(inner.X, Height / 2, inner.Width, Height / 2 - Theme.S(6));
            TextRenderer.DrawText(g, Text, Font, top, fore, (flags & ~TextFormatFlags.VerticalCenter) | TextFormatFlags.Bottom);
            TextRenderer.DrawText(g, SubText, Theme.Ui(9f), bottom, Theme.Blend(fore, BaseColor, 0.3f), (flags & ~TextFormatFlags.VerticalCenter) | TextFormatFlags.Top);
        }
        else
        {
            TextRenderer.DrawText(g, Text, Font, inner, fore, flags);
        }
    }
}

// =====================================================================
// Painel que empilha filhos verticalmente, esticando na largura
// =====================================================================
public class StackPanel : Panel
{
    private bool _inLayout;
    public int Spacing { get; set; } = 10;
    public int MaxContentWidth { get; set; } = 0;

    public StackPanel()
    {
        AutoScroll = true;
        DoubleBuffered = true;
        SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
    }

    protected override void OnLayout(LayoutEventArgs levent)
    {
        if (_inLayout) return;
        _inLayout = true;
        try
        {
            // a barra de rolagem pode aparecer/sumir e mudar a largura útil: refaz até estabilizar
            for (int pass = 0; pass < 3; pass++)
            {
                int before = ClientSize.Width;
                LayoutChildren();
                AdjustFormScrollbars(AutoScroll);
                if (ClientSize.Width == before) break;
            }
        }
        finally
        {
            _inLayout = false;
        }
    }

    private void LayoutChildren()
    {
        {
            int avail = ClientSize.Width - Padding.Horizontal;
            int w = MaxContentWidth > 0 ? Math.Min(avail, MaxContentWidth) : avail;
            int left = Padding.Left + Math.Max(0, (avail - w) / 2);
            int y = Padding.Top + AutoScrollPosition.Y;
            foreach (Control c in Controls)
            {
                if (!c.Visible) continue;
                int cw = Math.Max(10, w - c.Margin.Horizontal);
                if (c is IFlexHeight fh)
                {
                    c.Width = cw;
                    c.Height = fh.HeightForWidth(cw);
                }
                else if (c is Label && c.AutoSize)
                {
                    c.MaximumSize = new Size(cw, 0);
                }
                else if (c.AutoSize && c is not TextBoxBase)
                {
                    // containers AutoSize dependem do layout do pai: calculamos aqui
                    var pref = c.GetPreferredSize(new Size(cw, 0));
                    bool fullWidth = c is FlowLayoutPanel && !"center".Equals(c.Tag);
                    c.Size = new Size(fullWidth ? cw : Math.Min(cw, pref.Width), Math.Max(pref.Height, c.MinimumSize.Height));
                }
                else if (!"fixed".Equals(c.Tag))
                {
                    c.Width = cw;
                }
                int x = left + c.Margin.Left;
                if ("center".Equals(c.Tag)) x = left + (w - c.Width) / 2;
                c.Location = new Point(x, y + c.Margin.Top);
                y += c.Margin.Vertical + c.Height + Theme.S(Spacing);
            }
            AutoScrollMinSize = new Size(0, y - AutoScrollPosition.Y + Padding.Bottom);
        }
    }
    protected override void OnResize(EventArgs eventargs)
    {
        base.OnResize(eventargs);
        PerformLayout();
        Invalidate();
    }

    public T Add<T>(T c) where T : Control
    {
        Controls.Add(c);
        return c;
    }
}

// =====================================================================
// Caixa de texto pintada (altura flexível)
// =====================================================================
public class InfoBox : Control, IFlexHeight
{
    public Color FillColor { get; set; } = Theme.IndigoSoft;
    public Color BorderColor { get; set; } = Color.Empty;
    public Padding Inner { get; set; } = new(14, 10, 14, 10);

    public InfoBox(string text, Font font, Color fore, Color fill)
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Text = text;
        Font = font;
        ForeColor = fore;
        FillColor = fill;
        Margin = new Padding(0);
    }

    private const TextFormatFlags Flags = TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix | TextFormatFlags.NoPadding;

    public int HeightForWidth(int width)
    {
        int tw = Math.Max(20, width - Theme.S(Inner.Horizontal));
        return TextRenderer.MeasureText(Text, Font, new Size(tw, int.MaxValue), Flags).Height + Theme.S(Inner.Vertical);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        using (var path = Theme.RoundRect(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), Theme.S(10)))
        {
            using var b = new SolidBrush(FillColor);
            g.FillPath(b, path);
            if (BorderColor != Color.Empty)
            {
                using var p = new Pen(BorderColor);
                g.DrawPath(p, path);
            }
        }
        var r = new Rectangle(Theme.S(Inner.Left), Theme.S(Inner.Top), Width - Theme.S(Inner.Horizontal), Height - Theme.S(Inner.Vertical));
        TextRenderer.DrawText(g, Text, Font, r, ForeColor, Flags);
    }
}

// =====================================================================
// Bloco com texto japonês grande + leitura + romaji + botão de áudio
// =====================================================================
public class JpBlock : Panel, IFlexHeight
{
    private readonly Control _jp; // Label, ou RubyLabel quando há furigana
    private readonly Label? _reading;
    private readonly Label? _romaji;
    private readonly FlatButton? _speak;

    public JpBlock(string jp, float size, string? reading, string? romaji, Action? speak, Action? speakSlow)
    {
        BackColor = Color.White;
        Padding = Theme.Pad(18, 14, 18, 14);
        // furigana em cima dos kanji quando a leitura encaixa; senão, leitura numa linha acima (como antes)
        var ruby = reading != null ? new RubyLabel(jp, reading, Theme.Jp(size)) { ForeColor = Theme.Text, BackColor = Color.White } : null;
        if (ruby != null && ruby.Works)
        {
            Controls.Add(ruby);
            _jp = ruby;
        }
        else
        {
            ruby?.Dispose();
            if (reading != null) _reading = MakeLabel(reading, Theme.Jp(12f), Theme.Muted);
            _jp = MakeLabel(jp, Theme.Jp(size), Theme.Text);
        }
        if (romaji != null) _romaji = MakeLabel(romaji, Theme.Ui(10.5f, FontStyle.Italic), Theme.Muted);
        if (speak != null && Speech.Available)
        {
            _speak = FlatButton.Icon(Glyphs.Volume, "Ouvir (clique direito = devagar)", (_, _) => speak());
            _speak.MouseUp += (_, e) => { if (e.Button == MouseButtons.Right) speakSlow?.Invoke(); };
            Controls.Add(_speak);
        }
    }

    private Label MakeLabel(string text, Font font, Color color)
    {
        var l = new Label { Text = text, Font = font, ForeColor = color, AutoSize = false, UseMnemonic = false, BackColor = Color.White, TextAlign = ContentAlignment.MiddleLeft };
        Controls.Add(l);
        return l;
    }

    public int HeightForWidth(int width)
    {
        int maxW = Math.Max(60, width - Padding.Horizontal - (_speak != null ? Theme.S(56) : 0));
        int y = Padding.Top;
        foreach (var c in new Control?[] { _jp, _reading, _romaji })
        {
            if (c == null) continue;
            int h;
            if (c is RubyLabel rl) h = rl.HeightForWidth(maxW) + Theme.S(2);
            else
            {
                var sz = c.GetPreferredSize(new Size(maxW, 0));
                h = sz.Height + (int)(c.Font.Size > 30 ? c.Font.Height * 0.25f : Theme.S(2));
            }
            c.SetBounds(Padding.Left, y, maxW, h);
            y += h;
        }
        _speak?.SetBounds(width - Padding.Right - _speak.Width, Padding.Top, _speak.Width, _speak.Height);
        return Math.Max(y, (_speak?.Bottom ?? 0)) + Padding.Bottom;
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        using var path = Theme.RoundRect(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), Theme.S(12));
        using var b = new SolidBrush(Color.White);
        g.FillPath(b, path);
        using var p = new Pen(Theme.Border);
        g.DrawPath(p, path);
    }
}

// =====================================================================
// Rótulos utilitários
// =====================================================================
public static class Ui
{
    public static Label Label(string text, Font font, Color? color = null, Padding? margin = null)
    {
        return new Label
        {
            Text = text,
            Font = font,
            ForeColor = color ?? Theme.Text,
            AutoSize = true,
            UseMnemonic = false,
            Margin = margin ?? new Padding(0),
            BackColor = Color.Transparent,
        };
    }

    public static Label Title(string text) => Label(text, Theme.Ui(20f, FontStyle.Bold), Theme.Text);
    public static Label Subtitle(string text) => Label(text, Theme.Ui(11f), Theme.Muted);
    public static Label Section(string text) => Label(text, Theme.Ui(13f, FontStyle.Bold), Theme.Indigo, new Padding(0, Theme.S(8), 0, 0));

    public static FlowLayoutPanel Row(params Control[] controls)
    {
        var f = new FlowLayoutPanel
        {
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            WrapContents = true,
            FlowDirection = FlowDirection.LeftToRight,
            BackColor = Color.Transparent,
            Margin = new Padding(0),
        };
        foreach (var c in controls)
        {
            c.Margin = new Padding(0, 0, Theme.S(8), Theme.S(8));
            f.Controls.Add(c);
        }
        return f;
    }

    public static Panel Spacer(int h) => new() { Height = Theme.S(h), BackColor = Color.Transparent };
}

// =====================================================================
// Barra de progresso fina
// =====================================================================
public class ProgressLine : Control
{
    private float _value;
    public float Value { get => _value; set { _value = Math.Clamp(value, 0, 1); Invalidate(); } }
    public Color BarColor { get; set; } = Theme.Success;
    public Color TrackColor { get; set; } = Color.FromArgb(230, 228, 222);

    public ProgressLine()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Height = Theme.S(12);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var r = new RectangleF(0, 0, Width - 1, Height - 1);
        using (var p = Theme.RoundRect(r, Height / 2f))
        using (var b = new SolidBrush(TrackColor)) g.FillPath(b, p);
        if (_value > 0.001f)
        {
            var fw = Math.Max(Height, (Width - 1) * _value);
            using var p = Theme.RoundRect(new RectangleF(0, 0, fw, Height - 1), Height / 2f);
            using var b = new SolidBrush(BarColor);
            g.FillPath(b, p);
        }
    }
}

// =====================================================================
// Painel cartão (fundo branco arredondado)
// =====================================================================
public class CardPanel : Panel
{
    public Color FillColor { get; set; } = Theme.Card;
    public Color BorderColor { get; set; } = Theme.Border;
    public int Radius { get; set; } = 12;

    public CardPanel()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Padding = Theme.Pad(16);
        BackColor = Theme.Card;
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
        using var path = Theme.RoundRect(r, Theme.S(Radius));
        using var b = new SolidBrush(FillColor);
        g.FillPath(b, path);
        if (BorderColor != Color.Empty)
        {
            using var pen = new Pen(BorderColor);
            g.DrawPath(pen, path);
        }
    }
}

// =====================================================================
// Cartão de frase (exemplos e diálogos) — desenhado à mão, altura flexível
// =====================================================================
public class SentenceCard : Control, IFlexHeight
{
    public string Jp { get; }
    public string Reading { get; }
    public string Meaning { get; }
    public string? Speaker { get; set; }
    public Color SpeakerColor { get; set; } = Theme.Indigo;
    private bool _hover;

    private static Font JpFont => Theme.Jp(15f);
    private static Font ReadFont => Theme.Jp(10.5f);
    private static Font RomajiFont => Theme.Ui(10f, FontStyle.Italic);
    private static Font MeanFont => Theme.Ui(11f);

    public SentenceCard(string jp, string reading, string meaning)
    {
        Jp = jp;
        Reading = string.IsNullOrWhiteSpace(reading) ? jp : reading;
        Meaning = meaning;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Cursor = Cursors.Hand;
        Margin = new Padding(0);
        new ToolTip().SetToolTip(this, "Clique para ouvir · clique direito = devagar");
    }

    private bool ShowReading => ProgressStore.Data.Settings.ShowReading && Kana.ContainsKanji(Jp);
    private bool ShowRomaji => ProgressStore.Data.Settings.ShowRomaji;

    private int TextLeft => Theme.S(Speaker != null ? 64 : 18);
    private int TextWidth(int w) => w - TextLeft - Theme.S(56);

    /// <summary>Furigana em cima dos kanji (null se desligada ou se a leitura não encaixar).</summary>
    private RubyLayout? Ruby(int tw) => ShowReading ? RubyLayout.Build(Jp, Reading, JpFont, tw) : null;

    private IEnumerable<(string text, Font font, Color color)> Lines(bool withRuby)
    {
        if (!withRuby) yield return (Jp, JpFont, Theme.Text);
        if (ShowReading && !withRuby) yield return (Reading.Replace(" ", ""), ReadFont, Theme.Muted);
        if (ShowRomaji && Kana.ContainsJapanese(Reading)) yield return (Kana.ToRomaji(Reading), RomajiFont, Theme.Muted);
        yield return (Meaning, MeanFont, Theme.Indigo);
    }

    public int HeightForWidth(int width)
    {
        int tw = Math.Max(50, TextWidth(width));
        int h = Theme.S(14);
        var ruby = Ruby(tw);
        if (ruby != null) h += ruby.Height + Theme.S(3);
        foreach (var (text, font, _) in Lines(ruby != null))
            h += TextRenderer.MeasureText(text, font, new Size(tw, int.MaxValue), TextFormatFlags.WordBreak | TextFormatFlags.NoPadding).Height + Theme.S(3);
        return Math.Max(h + Theme.S(12), Theme.S(60));
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        Speech.Speak(Jp, e.Button == MouseButtons.Right);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
        using (var path = Theme.RoundRect(r, Theme.S(10)))
        {
            using var b = new SolidBrush(_hover ? Color.FromArgb(252, 251, 248) : Color.White);
            g.FillPath(b, path);
            using var pen = new Pen(_hover ? Theme.Indigo : Theme.Border);
            g.DrawPath(pen, path);
        }

        if (Speaker != null)
        {
            var c = new Rectangle(Theme.S(14), Theme.S(14), Theme.S(36), Theme.S(36));
            using var sb = new SolidBrush(SpeakerColor);
            g.FillEllipse(sb, c);
            TextRenderer.DrawText(g, Speaker.Length > 2 ? Speaker[..2] : Speaker, Theme.Jp(10f, FontStyle.Bold), c, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        int tw = Math.Max(50, TextWidth(Width));
        int y = Theme.S(12);
        var ruby = Ruby(tw);
        if (ruby != null)
        {
            ruby.Draw(g, TextLeft, y, Theme.Text, Theme.Muted);
            y += ruby.Height + Theme.S(3);
        }
        foreach (var (text, font, color) in Lines(ruby != null))
        {
            var sz = TextRenderer.MeasureText(text, font, new Size(tw, int.MaxValue), TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
            TextRenderer.DrawText(g, text, font, new Rectangle(TextLeft, y, tw, sz.Height), color, TextFormatFlags.WordBreak | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            y += sz.Height + Theme.S(3);
        }

        if (Speech.Available)
        {
            var ir = new Rectangle(Width - Theme.S(48), (Height - Theme.S(36)) / 2, Theme.S(36), Theme.S(36));
            using var ib = new SolidBrush(_hover ? Theme.Indigo : Theme.IndigoSoft);
            g.FillEllipse(ib, ir);
            TextRenderer.DrawText(g, Glyphs.Volume, Theme.Get(Glyphs.Font, 12f, FontStyle.Regular), ir, _hover ? Color.White : Theme.Indigo,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }
}

// =====================================================================
// Bloco de vocabulário (tamanho fixo, para FlowLayoutPanel)
// =====================================================================
public class VocabTile : Control
{
    public VocabItem Item { get; }
    private bool _hover;
    public Color AccentColor { get; set; } = Theme.Accent;

    public VocabTile(VocabItem item)
    {
        Item = item;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(Theme.S(250), Theme.S(118));
        Margin = new Padding(0, 0, Theme.S(10), Theme.S(10));
        Cursor = Cursors.Hand;
        new ToolTip().SetToolTip(this, $"{item.Jp}（{item.Reading}）\n{item.Meaning}\nClique para ouvir");
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); }
    protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); Speech.Speak(Item.Jp, e.Button == MouseButtons.Right); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
        using (var path = Theme.RoundRect(r, Theme.S(10)))
        {
            using var b = new SolidBrush(Color.White);
            g.FillPath(b, path);
            using var pen = new Pen(_hover ? AccentColor : Theme.Border, _hover ? 2 : 1);
            g.DrawPath(pen, path);
        }
        int pad = Theme.S(12);
        int w = Width - pad * 2;
        var jpFont = Theme.Jp(Item.Jp.Length > 9 ? 13f : 17f);
        int y = Theme.S(4);
        // furigana em cima dos kanji (cabe numa linha); se não encaixar, a leitura vai na linha de baixo
        var ruby = Item.HasKanji && ProgressStore.Data.Settings.ShowReading ? RubyLayout.Build(Item.Jp, Item.Reading, jpFont, w, wrap: false) : null;
        if (ruby != null && ruby.Width <= w)
        {
            ruby.Draw(g, pad, y, Theme.Text, Theme.Muted);
            y += ruby.Height;
        }
        else
        {
            ruby = null;
            y += Theme.S(4);
            var jpSz = TextRenderer.MeasureText(Item.Jp, jpFont);
            TextRenderer.DrawText(g, Item.Jp, jpFont, new Rectangle(pad, y, w, jpSz.Height), Theme.Text, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            y += jpSz.Height;
        }
        var sub = new List<string>();
        if (Item.HasKanji && ProgressStore.Data.Settings.ShowReading && ruby == null) sub.Add(Item.Reading);
        if (ProgressStore.Data.Settings.ShowRomaji) sub.Add(Item.Romaji);
        if (sub.Count > 0)
        {
            TextRenderer.DrawText(g, string.Join("  ·  ", sub), Theme.Jp(9.5f), new Rectangle(pad, y, w, Theme.S(20)), Theme.Muted, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            y += Theme.S(20);
        }
        TextRenderer.DrawText(g, Item.Meaning, Theme.Ui(10.5f), new Rectangle(pad, y + Theme.S(2), w, Height - y - Theme.S(6)), Theme.Indigo,
            TextFormatFlags.WordBreak | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}

// =====================================================================
// Bloco de kana / kanji (quadrado)
// =====================================================================
public class CharTile : Control
{
    public string Char { get; }
    public string Sub { get; set; }
    public bool Selected { get; set; }
    public int Weak { get; set; }
    private bool _hover;
    public float CharSize { get; set; } = 22f;

    public CharTile(string ch, string sub, int size = 68)
    {
        Char = ch;
        Sub = sub;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(Theme.S(size), Theme.S(size + 6));
        Margin = new Padding(0, 0, Theme.S(6), Theme.S(6));
        Cursor = string.IsNullOrEmpty(ch) ? Cursors.Default : Cursors.Hand;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Theme.BackOf(this));
        if (string.IsNullOrEmpty(Char)) return;
        var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
        using (var path = Theme.RoundRect(r, Theme.S(8)))
        {
            var fill = Selected ? Theme.AccentSoft : Color.White;
            using var b = new SolidBrush(fill);
            g.FillPath(b, path);
            using var pen = new Pen(Selected ? Theme.Accent : _hover ? Theme.Indigo : Theme.Border, Selected || _hover ? 2 : 1);
            g.DrawPath(pen, path);
        }
        var top = new Rectangle(0, Theme.S(2), Width, Height - Theme.S(22));
        TextRenderer.DrawText(g, Char, Theme.Jp(Char.Length > 1 ? CharSize * 0.8f : CharSize), top, Theme.Text, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g, Sub, Theme.Ui(9f), new Rectangle(0, Height - Theme.S(24), Width, Theme.S(20)), Theme.Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        if (Weak > 0)
        {
            using var wb = new SolidBrush(Theme.Warning);
            g.FillEllipse(wb, Width - Theme.S(14), Theme.S(5), Theme.S(8), Theme.S(8));
        }
    }
}

// =====================================================================
// Renderizador de teoria (mini-markdown -> RTF -> RichTextBox)
// =====================================================================
public static class TheoryRenderer
{
    [DllImport("user32.dll")] private static extern bool HideCaret(IntPtr hWnd);

    // índices da tabela de cores do RTF
    private const int CText = 1, CAccent = 2, CIndigo = 3, CMuted = 4, CAccentDark = 5, CTip = 6,
                      BgTip = 7, BgWarn = 8, BgHead = 9, BgAlt = 10;

    private static readonly Color[] Palette =
    {
        Theme.Text, Theme.Accent, Theme.Indigo, Theme.Muted, Theme.AccentDark, Color.FromArgb(110, 75, 0),
        Theme.WarningSoft, Theme.ErrorSoft, Theme.IndigoSoft, Color.FromArgb(244, 244, 248),
    };

    public static RichTextBox Create()
    {
        var rtb = new RichTextBox
        {
            ReadOnly = true,
            BorderStyle = BorderStyle.None,
            BackColor = Color.White,
            Dock = DockStyle.Fill,
            ScrollBars = RichTextBoxScrollBars.Vertical,
            DetectUrls = false,
            Cursor = Cursors.Arrow,
            ShortcutsEnabled = true,
        };
        rtb.GotFocus += (_, _) => HideCaret(rtb.Handle);
        rtb.MouseUp += (_, _) => HideCaret(rtb.Handle);
        return rtb;
    }

    /// <summary>
    /// Mostra a teoria. O RichTextBox reaplica a fonte padrão a todo o texto quando o identificador
    /// da janela é (re)criado, então o RTF é aplicado sempre depois disso.
    /// </summary>
    public static void Attach(RichTextBox rtb, IList<string> lines)
    {
        var rtf = BuildRtf(lines);
        void Apply()
        {
            if (rtb.IsDisposed) return;
            rtb.Rtf = rtf;
            rtb.SelectionStart = 0;
            rtb.ScrollToCaret();
        }
        rtb.HandleCreated += (_, _) => rtb.BeginInvoke(Apply);
        if (rtb.IsHandleCreated) rtb.BeginInvoke(Apply);
    }

    public static string BuildRtf(IList<string> lines)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append(@"{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\fnil Segoe UI;}{\f1\fnil ").Append(Theme.JpFamily).Append(";}}");
        sb.Append(@"{\colortbl ;");
        foreach (var c in Palette) sb.Append($@"\red{c.R}\green{c.G}\blue{c.B};");
        sb.Append(@"}\viewkind4\uc1 ");

        int i = 0;
        while (i < lines.Count)
        {
            if (lines[i].TrimStart().StartsWith("|"))
            {
                var rows = new List<string[]>();
                while (i < lines.Count && lines[i].TrimStart().StartsWith("|"))
                {
                    var cells = lines[i].Trim().Trim('|').Split('|').Select(c => c.Trim()).ToArray();
                    if (!cells.All(c => c.Length > 0 && c.All(ch => ch == '-' || ch == ':')))
                        rows.Add(cells);
                    i++;
                }
                Table(sb, rows);
                continue;
            }
            Line(sb, lines[i]);
            i++;
        }
        sb.Append('}');
        return sb.ToString();
    }

    private static void Para(System.Text.StringBuilder sb, int li = 60, int fi = 0, int before = 0, int after = 70, string tabs = "")
        => sb.Append($@"\pard\li{li}\fi{fi}\sb{before}\sa{after}{tabs} ");

    private static void EndPara(System.Text.StringBuilder sb) => sb.Append(@"\par" + "\r\n");

    private static void Line(System.Text.StringBuilder sb, string line)
    {
        if (line.StartsWith("# "))
        {
            Para(sb, before: 40, after: 140);
            Run(sb, line[2..], 18f, true, CAccent, 0, Kana.ContainsJapanese(line));
        }
        else if (line.StartsWith("## "))
        {
            Para(sb, before: 220, after: 90);
            Inline(sb, line[3..], 13.5f, CIndigo, 0, allBold: true);
        }
        else if (line.StartsWith("- "))
        {
            Para(sb, li: 460, fi: -260, after: 50, tabs: @"\tx460");
            Run(sb, "•", 11.5f, true, CAccent, 0, false);
            sb.Append(@"\tab ");
            Inline(sb, line[2..], 11.5f, CText, 0);
        }
        else if (line.StartsWith("> "))
        {
            Para(sb, li: 160, before: 80, after: 80);
            Inline(sb, "💡 " + line[2..], 11.5f, CTip, BgTip);
        }
        else if (line.StartsWith("! "))
        {
            Para(sb, li: 160, before: 80, after: 80);
            Inline(sb, "⚠ " + line[2..], 11.5f, CAccentDark, BgWarn);
        }
        else if (line.StartsWith("ex: "))
        {
            Para(sb, li: 420, before: 30, after: 30);
            Inline(sb, line[4..], 13f, CIndigo, 0);
        }
        else if (line.Trim().Length == 0)
        {
            Para(sb, after: 0);
            sb.Append(@"\fs10 ");
        }
        else
        {
            Para(sb);
            Inline(sb, line, 11.5f, CText, 0);
        }
        EndPara(sb);
    }

    private static void Table(System.Text.StringBuilder sb, List<string[]> rows)
    {
        if (rows.Count == 0) return;
        int cols = rows.Max(r => r.Length);
        var widthsPx = new int[cols];
        for (int r = 0; r < rows.Count; r++)
            for (int c = 0; c < rows[r].Length; c++)
            {
                var text = rows[r][c].Replace("**", "");
                var font = Kana.ContainsJapanese(text) ? Theme.Jp(12.5f, FontStyle.Bold) : Theme.Ui(11f, FontStyle.Bold);
                widthsPx[c] = Math.Max(widthsPx[c], TextRenderer.MeasureText(text, font).Width);
            }
        // px -> twips (1px a 96dpi = 15 twips)
        int left = 200;
        var tabs = new System.Text.StringBuilder();
        int acc = left;
        for (int c = 0; c < cols - 1; c++)
        {
            acc += (int)(widthsPx[c] * 15 / Theme.Scale) + 420;
            tabs.Append(@"\tx").Append(acc);
        }
        Para(sb, after: 0);
        sb.Append(@"\fs8 ");
        EndPara(sb);
        for (int r = 0; r < rows.Count; r++)
        {
            int bg = r == 0 ? BgHead : (r % 2 == 0 ? BgAlt : 0);
            Para(sb, li: left, after: 30, tabs: tabs.ToString());
            for (int c = 0; c < rows[r].Length; c++)
            {
                if (c > 0)
                {
                    sb.Append('{');
                    if (bg > 0) sb.Append(@"\highlight").Append(bg);
                    sb.Append(@"\tab}");
                }
                Inline(sb, " " + rows[r][c] + " ", 11f, r == 0 ? CIndigo : CText, bg, allBold: r == 0);
            }
            EndPara(sb);
        }
        Para(sb, after: 0);
        sb.Append(@"\fs12 ");
        EndPara(sb);
    }

    /// <summary>Texto com **negrito** e trechos em japonês com fonte própria.</summary>
    private static void Inline(System.Text.StringBuilder sb, string text, float size, int color, int bg, bool allBold = false)
    {
        var parts = text.Split("**");
        for (int p = 0; p < parts.Length; p++)
        {
            bool bold = allBold || p % 2 == 1;
            int col = bold && !allBold && color == CText ? CAccentDark : color;
            foreach (var (run, jp) in SplitRuns(parts[p]))
                Run(sb, run, jp ? size + 1.5f : size, bold, col, bg, jp);
        }
    }

    private static void Run(System.Text.StringBuilder sb, string text, float size, bool bold, int color, int bg, bool jp)
    {
        if (text.Length == 0) return;
        sb.Append(@"{\f").Append(jp ? 1 : 0)
          .Append(@"\fs").Append((int)Math.Round(size * 2))
          .Append(bold ? @"\b" : @"\b0")
          .Append(@"\cf").Append(color);
        if (bg > 0) sb.Append(@"\highlight").Append(bg);
        sb.Append(' ');
        foreach (var ch in text)
        {
            switch (ch)
            {
                case '\\': sb.Append(@"\\"); break;
                case '{': sb.Append(@"\{"); break;
                case '}': sb.Append(@"\}"); break;
                case '\t': sb.Append(@"\tab "); break;
                case '\n': sb.Append(@"\line "); break;
                case '\r': break;
                default:
                    if (ch < 0x80) sb.Append(ch);
                    else sb.Append(@"\u").Append((short)ch).Append('?');
                    break;
            }
        }
        sb.Append('}');
    }

    private static IEnumerable<(string, bool)> SplitRuns(string s)
    {
        if (s.Length == 0) yield break;
        var sb = new System.Text.StringBuilder();
        bool? cur = null;
        foreach (var ch in s)
        {
            bool jp = Kana.ContainsJapanese(ch.ToString());
            bool neutral = ch == ' ' || ch == '·' || ch == '→' || ch == '(' || ch == ')' || ch == ',' || ch == '/';
            if (cur.HasValue && !neutral && jp != cur.Value)
            {
                yield return (sb.ToString(), cur.Value);
                sb.Clear();
            }
            if (!neutral || cur == null) cur = jp;
            sb.Append(ch);
        }
        if (sb.Length > 0) yield return (sb.ToString(), cur ?? false);
    }
}
