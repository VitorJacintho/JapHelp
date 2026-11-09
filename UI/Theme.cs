using System.Drawing.Drawing2D;
using System.Drawing.Text;

namespace JapHelp.UI;

public static class Theme
{
    public static readonly Color Background = Color.FromArgb(247, 245, 241);
    public static readonly Color Sidebar = Color.FromArgb(30, 33, 48);
    public static readonly Color SidebarHover = Color.FromArgb(44, 48, 68);
    public static readonly Color SidebarActive = Color.FromArgb(214, 69, 69);
    public static readonly Color Accent = Color.FromArgb(214, 69, 69);
    public static readonly Color AccentDark = Color.FromArgb(176, 48, 48);
    public static readonly Color AccentSoft = Color.FromArgb(252, 233, 231);
    public static readonly Color Indigo = Color.FromArgb(52, 73, 140);
    public static readonly Color IndigoSoft = Color.FromArgb(230, 235, 248);
    public static readonly Color Success = Color.FromArgb(39, 150, 90);
    public static readonly Color SuccessSoft = Color.FromArgb(222, 245, 230);
    public static readonly Color Error = Color.FromArgb(200, 55, 55);
    public static readonly Color ErrorSoft = Color.FromArgb(252, 228, 228);
    public static readonly Color Warning = Color.FromArgb(214, 140, 20);
    public static readonly Color WarningSoft = Color.FromArgb(255, 245, 214);
    public static readonly Color Card = Color.White;
    public static readonly Color Border = Color.FromArgb(226, 222, 214);
    public static readonly Color Text = Color.FromArgb(34, 34, 40);
    public static readonly Color Muted = Color.FromArgb(110, 110, 120);

    private static readonly Dictionary<string, Font> FontCache = new();

    public static string JpFamily { get; } = PickFamily("Yu Gothic UI", "Meiryo UI", "Meiryo", "MS UI Gothic", "MS Gothic", "Segoe UI");
    public static string JpTraceFamily { get; } = PickFamily("Yu Gothic", "Yu Gothic UI", "Meiryo", "MS Gothic", "Segoe UI");

    private static string PickFamily(params string[] names)
    {
        using var fonts = new InstalledFontCollection();
        var installed = fonts.Families.Select(f => f.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return names.FirstOrDefault(installed.Contains) ?? "Segoe UI";
    }

    public static Font Ui(float size, FontStyle style = FontStyle.Regular) => Get("Segoe UI", size, style);
    public static Font UiSemi(float size) => Get("Segoe UI Semibold", size, FontStyle.Regular);
    public static Font Jp(float size, FontStyle style = FontStyle.Regular) => Get(JpFamily, size, style);

    public static Font Get(string family, float size, FontStyle style)
    {
        var key = $"{family}|{size}|{style}";
        if (!FontCache.TryGetValue(key, out var f))
        {
            f = new Font(family, size, style);
            FontCache[key] = f;
        }
        return f;
    }

    /// <summary>Cor de fundo real atrás de um controle (ignora pais transparentes).</summary>
    public static Color BackOf(Control? c)
    {
        var p = c?.Parent;
        while (p != null)
        {
            if (p.BackColor.A == 255) return p.BackColor;
            p = p.Parent;
        }
        return Background;
    }

    /// <summary>Fator de escala do DPI do sistema.</summary>
    public static float Scale { get; set; } = 1f;
    public static int S(int px) => (int)Math.Round(px * Scale);
    public static Padding Pad(int all) => new(S(all));
    public static Padding Pad(int l, int t, int r, int b) => new(S(l), S(t), S(r), S(b));

    public static Color FromHex(string hex, Color fallback)
    {
        try { return ColorTranslator.FromHtml(hex); } catch { return fallback; }
    }

    public static Color Blend(Color a, Color b, float t) => Color.FromArgb(
        (int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));

    public static GraphicsPath RoundRect(RectangleF r, float radius)
    {
        var path = new GraphicsPath();
        float d = radius * 2;
        if (d <= 0 || r.Width < d || r.Height < d)
        {
            path.AddRectangle(r);
            return path;
        }
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}
