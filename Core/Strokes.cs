using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace JapHelp.Core;

/// <summary>
/// Ordem dos traços (dados do KanjiVG, mobile/data/tracos.json) e conferência do desenho do aluno.
/// Coordenadas do KanjiVG: caixa de 109 x 109. Mesma lógica do celular (mobile/js/strokes.js).
/// KanjiVG © Ulrich Apel — CC BY-SA 3.0 (https://kanjivg.tagaini.net).
/// </summary>
public static class Strokes
{
    public const float Box = 109f;
    private const int Samples = 24;

    private static Dictionary<string, string[]>? _data;

    public static string DataPath => Path.Combine(AppContext.BaseDirectory, "Content", "tracos.json");

    /// <summary>Caminhos SVG dos traços de um caractere (null se não há dados).</summary>
    public static string[]? Get(string ch)
    {
        if (_data == null)
        {
            try { _data = JsonSerializer.Deserialize<Dictionary<string, string[]>>(File.ReadAllText(DataPath)) ?? new(); }
            catch { _data = new(); }
        }
        return _data.TryGetValue(ch, out var p) ? p : null;
    }

    public static IReadOnlyCollection<string> AllChars { get { Get(""); return _data!.Keys; } }

    // ------------------------------------------------------------ caminhos SVG → pontos
    private static readonly Regex Token = new(@"[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", RegexOptions.Compiled);

    /// <summary>Converte um caminho SVG (M, L, H, V, C, S, Q, T, Z) em pontos ao longo do traço.</summary>
    public static List<PointF> PathPoints(string d, float step = 1.5f)
    {
        var tok = Token.Matches(d).Select(m => m.Value).ToList();
        var pts = new List<PointF>();
        int i = 0;
        string cmd = "";
        float x = 0, y = 0, sx = 0, sy = 0;
        PointF? ctrl = null;
        float Num()
        {
            if (i >= tok.Count || !float.TryParse(tok[i++], NumberStyles.Float, CultureInfo.InvariantCulture, out var v))
                throw new FormatException("caminho inválido");
            return v;
        }
        void Add(float px, float py) => pts.Add(new PointF(px, py));
        void Line(float nx, float ny)
        {
            int n = Math.Max(1, (int)Math.Ceiling(Dist(x, y, nx, ny) / step));
            for (int k = 1; k <= n; k++) Add(x + (nx - x) * k / n, y + (ny - y) * k / n);
            x = nx; y = ny;
        }
        void Cubic(float x1, float y1, float x2, float y2, float nx, float ny)
        {
            float len = Dist(x, y, x1, y1) + Dist(x1, y1, x2, y2) + Dist(x2, y2, nx, ny);
            int n = Math.Max(2, (int)Math.Ceiling(len / step));
            for (int k = 1; k <= n; k++)
            {
                float t = (float)k / n, u = 1 - t;
                Add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx,
                    u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny);
            }
            ctrl = new PointF(x2, y2);
            x = nx; y = ny;
        }
        void Quad(float x1, float y1, float nx, float ny)
        {
            Cubic(x + 2f / 3 * (x1 - x), y + 2f / 3 * (y1 - y), nx + 2f / 3 * (x1 - nx), ny + 2f / 3 * (y1 - ny), nx, ny);
            ctrl = new PointF(x1, y1);
        }
        while (i < tok.Count)
        {
            if (char.IsLetter(tok[i][0])) cmd = tok[i++];
            bool rel = cmd.Length > 0 && char.IsLower(cmd[0]);
            float ox = rel ? x : 0, oy = rel ? y : 0;
            switch (char.ToUpperInvariant(cmd.Length > 0 ? cmd[0] : ' '))
            {
                case 'M':
                    x = Num() + ox; y = Num() + oy; sx = x; sy = y;
                    Add(x, y);
                    cmd = rel ? "l" : "L"; // pares seguintes são linhas
                    ctrl = null;
                    break;
                case 'L': { float nx = Num() + ox, ny = Num() + oy; Line(nx, ny); ctrl = null; break; }
                case 'H': Line(Num() + ox, y); ctrl = null; break;
                case 'V': Line(x, Num() + oy); ctrl = null; break;
                case 'C':
                {
                    float x1 = Num() + ox, y1 = Num() + oy, x2 = Num() + ox, y2 = Num() + oy, nx = Num() + ox, ny = Num() + oy;
                    Cubic(x1, y1, x2, y2, nx, ny);
                    break;
                }
                case 'S':
                {
                    float x1 = ctrl.HasValue ? 2 * x - ctrl.Value.X : x, y1 = ctrl.HasValue ? 2 * y - ctrl.Value.Y : y;
                    float x2 = Num() + ox, y2 = Num() + oy, nx = Num() + ox, ny = Num() + oy;
                    Cubic(x1, y1, x2, y2, nx, ny);
                    break;
                }
                case 'Q': { float x1 = Num() + ox, y1 = Num() + oy; float nx = Num() + ox, ny = Num() + oy; Quad(x1, y1, nx, ny); break; }
                case 'T':
                {
                    float x1 = ctrl.HasValue ? 2 * x - ctrl.Value.X : x, y1 = ctrl.HasValue ? 2 * y - ctrl.Value.Y : y;
                    float nx = Num() + ox, ny = Num() + oy;
                    Quad(x1, y1, nx, ny);
                    break;
                }
                case 'Z': Line(sx, sy); ctrl = null; break;
                default: i++; break; // token inesperado: pula
            }
        }
        return pts;
    }

    private static float Dist(float ax, float ay, float bx, float by) => MathF.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
    private static float Dist(PointF a, PointF b) => Dist(a.X, a.Y, b.X, b.Y);

    public static float PathLength(IReadOnlyList<PointF> pts)
    {
        float s = 0;
        for (int k = 1; k < pts.Count; k++) s += Dist(pts[k - 1], pts[k]);
        return s;
    }

    /// <summary>Reamostra a linha em n pontos igualmente espaçados.</summary>
    public static List<PointF> Resample(IReadOnlyList<PointF> pts, int n = Samples)
    {
        if (pts.Count == 0) return new();
        float total = PathLength(pts);
        if (pts.Count == 1 || total == 0) return Enumerable.Repeat(pts[0], n).ToList();
        var output = new List<PointF> { pts[0] };
        float step = total / (n - 1);
        float acc = 0;
        int k = 1;
        var prev = pts[0];
        while (output.Count < n - 1 && k < pts.Count)
        {
            var cur = pts[k];
            float seg = Dist(prev, cur);
            if (acc + seg >= step && seg > 0)
            {
                float t = (step - acc) / seg;
                var p = new PointF(prev.X + (cur.X - prev.X) * t, prev.Y + (cur.Y - prev.Y) * t);
                output.Add(p);
                prev = p;
                acc = 0;
            }
            else
            {
                acc += seg;
                prev = cur;
                k++;
            }
        }
        while (output.Count < n) output.Add(pts[^1]);
        return output;
    }

    private static float MeanDist(IReadOnlyList<PointF> a, IReadOnlyList<PointF> b)
    {
        float s = 0;
        for (int k = 0; k < a.Count; k++) s += Dist(a[k], b[k]);
        return s / a.Count;
    }

    /// <summary>Sentido do traço em palavras ("de cima para baixo", "da esquerda para a direita"...).</summary>
    public static string DirectionText(IReadOnlyList<PointF> pts)
    {
        var a = pts[0];
        var b = pts[^1];
        float dx = b.X - a.X, dy = b.Y - a.Y;
        var parts = new List<string>();
        if (Math.Abs(dy) > 8) parts.Add(dy > 0 ? "de cima para baixo" : "de baixo para cima");
        if (Math.Abs(dx) > 8) parts.Add(dx > 0 ? "da esquerda para a direita" : "da direita para a esquerda");
        return parts.Count > 0 ? string.Join(", ", parts) : "curto";
    }

    public enum Issue { None, Direction, Order, Shape, Extra }
    public record StrokeResult(bool Ok, Issue Issue, int Matches);
    public record CheckResult(bool Ok, int Expected, int Drawn, List<StrokeResult> Results, float Score, List<List<PointF>> RefPoints);

    /// <summary>Confere o desenho do aluno (traços em coordenadas 0..109) contra o modelo do KanjiVG.</summary>
    public static CheckResult Check(IReadOnlyList<string> refPaths, IReadOnlyList<IReadOnlyList<PointF>> userStrokes, bool normalize = true, float tolerance = 15)
    {
        var refPts = refPaths.Select(d => PathPoints(d)).ToList();
        var refR = refPts.Select(p => Resample(p)).ToList();
        var user = userStrokes.Where(s => s.Count > 0).Select(s => s.ToList()).ToList();
        if (normalize && user.Count > 0)
        {
            var rb = BBox(refPts);
            var ub = BBox(user);
            float rd = Math.Max(Math.Max(rb.Width, rb.Height), 10);
            float ud = Math.Max(Math.Max(ub.Width, ub.Height), 10);
            // escala limitada: desenho muito menor/maior que o modelo não vira "certo" só por ser ampliado
            float sc = Math.Min(2.5f, Math.Max(0.4f, rd / ud));
            float rcx = rb.X + rb.Width / 2, rcy = rb.Y + rb.Height / 2, ucx = ub.X + ub.Width / 2, ucy = ub.Y + ub.Height / 2;
            user = user.Select(s => s.Select(p => new PointF(rcx + (p.X - ucx) * sc, rcy + (p.Y - ucy) * sc)).ToList()).ToList();
        }
        var userR = user.Select(p => Resample(p)).ToList();
        var refLen = refPts.Select(PathLength).ToList();

        var results = new List<StrokeResult>();
        for (int i = 0; i < userR.Count; i++)
        {
            var u = userR[i];
            if (i >= refR.Count) { results.Add(new(false, Issue.Extra, -1)); continue; }
            var ur = Enumerable.Reverse(u).ToList();
            bool shortStroke = refLen[i] < 14; // pontinhos: o sentido não importa
            float fwd = MeanDist(u, refR[i]);
            float rev = MeanDist(ur, refR[i]);
            float own = shortStroke ? Math.Min(fwd, rev) : fwd;
            int best = -1;
            float bestD = float.PositiveInfinity;
            for (int j = 0; j < refR.Count; j++)
            {
                if (j == i) continue;
                float dd = Math.Min(MeanDist(u, refR[j]), refLen[j] < 14 ? MeanDist(ur, refR[j]) : float.PositiveInfinity);
                if (dd < bestD) { bestD = dd; best = j; }
            }
            // traços vizinhos e parecidos: só é "ordem trocada" se encaixa claramente melhor no outro
            bool clearlyOther = bestD <= tolerance && own > 7 && bestD < own * 0.5f;
            if (own <= tolerance && !clearlyOther) results.Add(new(true, Issue.None, i));
            else if (rev <= tolerance && rev < bestD) results.Add(new(false, Issue.Direction, i));
            else if (bestD <= tolerance) results.Add(new(false, Issue.Order, best));
            else results.Add(new(false, Issue.Shape, -1));
        }
        int good = results.Count(r => r.Ok);
        return new CheckResult(
            results.Count == refPts.Count && good == refPts.Count,
            refPts.Count,
            results.Count,
            results,
            refPts.Count > 0 ? (float)good / Math.Max(refPts.Count, results.Count) : 0,
            refPts);
    }

    private static RectangleF BBox(IEnumerable<IReadOnlyList<PointF>> strokes)
    {
        float x0 = float.PositiveInfinity, y0 = float.PositiveInfinity, x1 = float.NegativeInfinity, y1 = float.NegativeInfinity;
        foreach (var s in strokes)
            foreach (var p in s) { x0 = Math.Min(x0, p.X); y0 = Math.Min(y0, p.Y); x1 = Math.Max(x1, p.X); y1 = Math.Max(y1, p.Y); }
        return RectangleF.FromLTRB(x0, y0, x1, y1);
    }

    /// <summary>Texto explicando o resultado (o mesmo do celular).</summary>
    public static (bool Ok, string Text) Describe(CheckResult r, bool fromMemory)
    {
        if (r.Ok) return (true, fromMemory ? "Perfeito, de memória! すばらしい！" : "Certo! Ordem e sentido dos traços corretos. 👏");
        var lines = new List<string> { $"{r.Results.Count(x => x.Ok)} de {r.Expected} traços certos." };
        if (r.Drawn != r.Expected) lines.Add($"Você fez {r.Drawn} {(r.Drawn == 1 ? "traço" : "traços")}; o certo são {r.Expected}.");
        for (int k = 0; k < r.Results.Count && lines.Count <= 5; k++)
        {
            var x = r.Results[k];
            if (x.Ok) continue;
            int n = k + 1;
            if (x.Issue == Issue.Direction) lines.Add($"Traço {n}: sentido invertido — este vai {DirectionText(r.RefPoints[k])}.");
            else if (x.Issue == Issue.Order) lines.Add($"Traço {n}: ordem trocada — esse é o traço nº {x.Matches + 1}.");
            else if (x.Issue == Issue.Shape) lines.Add($"Traço {n}: forma ou posição diferente do modelo.");
        }
        lines.Add("Os números no quadro mostram a ordem certa.");
        return (false, string.Join("\n", lines));
    }
}
