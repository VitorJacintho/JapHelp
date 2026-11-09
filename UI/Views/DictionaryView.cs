using JapHelp.Core;

namespace JapHelp.UI.Views;

/// <summary>Busca em todo o vocabulário do curso, kanji e frases.</summary>
public class DictionaryView : UserControl
{
    private readonly ListView _lv;
    private readonly TextBox _search;
    private readonly Label _count;
    private readonly List<(VocabItem v, string source)> _all;
    private readonly System.Windows.Forms.Timer _debounce = new() { Interval = 220 };

    public DictionaryView()
    {
        BackColor = Theme.Background;
        Padding = Theme.Pad(28, 20, 28, 20);

        _all = new();
        foreach (var l in ContentRepository.AllLessons)
            foreach (var v in l.VocabItems) _all.Add((v, l.Title));
        foreach (var c in ContentRepository.Phrases)
            foreach (var v in c.Items) _all.Add((v, "Frases: " + c.Name));
        foreach (var k in ContentRepository.Kanji)
            foreach (var w in k.Words) _all.Add((w, $"Kanji {k.Char} ({k.Level})"));
        _all = _all.GroupBy(x => x.v.Jp + "|" + x.v.Meaning).Select(g => g.First()).ToList();

        var top = new Panel { Dock = DockStyle.Top, Height = Theme.S(112), BackColor = Theme.Background };
        var title = Ui.Title("Dicionário do curso");
        title.Location = new Point(0, 0);
        _search = new TextBox { Font = Theme.Jp(13f), PlaceholderText = "Digite em português, romaji (ex.: taberu) ou japonês…", Width = Theme.S(520), Location = new Point(Theme.S(2), Theme.S(48)) };
        _count = Ui.Label("", Theme.Ui(10f), Theme.Muted);
        _count.Location = new Point(Theme.S(540), Theme.S(54));
        var hint = Ui.Label("Duplo clique (ou Enter) para ouvir · Ctrl+C copia a palavra", Theme.Ui(9.5f), Theme.Muted);
        hint.Location = new Point(Theme.S(2), Theme.S(88));
        top.Controls.AddRange(new Control[] { title, _search, _count, hint });

        _lv = new ListView
        {
            Dock = DockStyle.Fill,
            View = View.Details,
            FullRowSelect = true,
            GridLines = false,
            HideSelection = false,
            Font = Theme.Jp(12f),
            BorderStyle = BorderStyle.None,
        };
        _lv.Columns.Add("Japonês", Theme.S(200));
        _lv.Columns.Add("Leitura", Theme.S(200));
        _lv.Columns.Add("Romaji", Theme.S(180));
        _lv.Columns.Add("Significado", Theme.S(330));
        _lv.Columns.Add("Origem", Theme.S(230));
        _lv.DoubleClick += (_, _) => SpeakSelected();
        _lv.KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Enter) SpeakSelected();
            if (e.Control && e.KeyCode == Keys.C && _lv.SelectedItems.Count > 0)
                Clipboard.SetText(_lv.SelectedItems[0].Text);
        };

        _debounce.Tick += (_, _) => { _debounce.Stop(); Fill(); };
        _search.TextChanged += (_, _) => { _debounce.Stop(); _debounce.Start(); };

        var card = new CardPanel { Dock = DockStyle.Fill, Padding = Theme.Pad(8) };
        card.Controls.Add(_lv);
        Controls.Add(card);
        Controls.Add(top);
        Fill();
    }

    private void SpeakSelected()
    {
        if (_lv.SelectedItems.Count > 0) Speech.Speak(_lv.SelectedItems[0].Text);
    }

    private void Fill()
    {
        var q = _search.Text.Trim();
        IEnumerable<(VocabItem v, string source)> res = _all;
        if (q.Length > 0)
        {
            var fq = Kana.Fold(q);
            var lower = q.ToLowerInvariant().Replace(" ", "");
            var kq = Kana.ContainsJapanese(q) ? Kana.ToHiragana(q) : Kana.RomajiToHiragana(lower);
            res = _all.Where(x =>
                    Kana.Fold(x.v.Meaning).Contains(fq) ||
                    x.v.Jp.Contains(q) ||
                    Kana.ToHiragana(x.v.Reading).Replace(" ", "").Contains(kq) ||
                    x.v.Romaji.Replace(" ", "").Replace("'", "").Contains(lower))
                .OrderBy(x => Kana.Fold(x.v.Meaning).StartsWith(fq) || x.v.Romaji.StartsWith(lower) ? 0 : 1)
                .ThenBy(x => x.v.Jp.Length);
        }
        var list = res.Take(800).ToList();
        _lv.BeginUpdate();
        _lv.Items.Clear();
        foreach (var (v, src) in list)
        {
            var it = new ListViewItem(v.Jp);
            it.SubItems.Add(v.Reading);
            it.SubItems.Add(v.Romaji);
            it.SubItems.Add(v.Meaning);
            it.SubItems.Add(src);
            _lv.Items.Add(it);
        }
        _lv.EndUpdate();
        _count.Text = $"{list.Count} de {_all.Count} entradas";
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _debounce.Dispose();
        base.Dispose(disposing);
    }
}
