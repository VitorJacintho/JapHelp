using System.Text.Json.Serialization;

namespace JapHelp.Core;

/// <summary>Um módulo (nível) do curso, carregado de Content/*.json.</summary>
public class CourseModule
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Level { get; set; } = "";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "#C0392B";
    public int Order { get; set; }
    public List<Lesson> Lessons { get; set; } = new();
}

public class Lesson
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    /// <summary>Linhas de teoria em mini-markdown (#, ##, -, >, !, |tabela|, **negrito**).</summary>
    public List<string> Theory { get; set; } = new();
    /// <summary>[japonês, leitura em kana, significado]</summary>
    public List<string[]> Vocab { get; set; } = new();
    /// <summary>[japonês, leitura em kana (com espaços), tradução]</summary>
    public List<string[]> Examples { get; set; } = new();
    /// <summary>[quem fala, japonês, leitura, tradução]</summary>
    public List<string[]> Dialog { get; set; } = new();
    public List<ExerciseDef> Exercises { get; set; } = new();
    /// <summary>Kana ensinados nesta lição, separados por espaço (gera treino automático).</summary>
    public string? Kana { get; set; }

    [JsonIgnore] public CourseModule Module { get; set; } = null!;
    [JsonIgnore] public int Index { get; set; }

    public IEnumerable<VocabItem> VocabItems => Vocab.Where(v => v.Length >= 3).Select(v => new VocabItem(v[0], v[1], v[2], Id));
}

/// <summary>Exercício escrito à mão no JSON.</summary>
public class ExerciseDef
{
    /// <summary>mc = múltipla escolha, type = digitar, order = montar frase, listen = ouvir</summary>
    public string T { get; set; } = "mc";
    public string? Ctx { get; set; }
    public string? Jp { get; set; }
    public string? Q { get; set; }
    public List<string>? O { get; set; }
    public int A { get; set; }
    /// <summary>Respostas aceitas (type).</summary>
    public List<string>? Acc { get; set; }
    /// <summary>Peças na ordem correta (order).</summary>
    public List<string>? W { get; set; }
    /// <summary>Peças extras de distração (order).</summary>
    public List<string>? X { get; set; }
    /// <summary>Texto a ser falado (listen).</summary>
    public string? S { get; set; }
    /// <summary>Explicação mostrada após responder.</summary>
    public string? E { get; set; }
    public string? Hint { get; set; }
}

public record VocabItem(string Jp, string ReadingRaw, string Meaning, string Source)
{
    public string Reading => string.IsNullOrWhiteSpace(ReadingRaw) ? Jp : ReadingRaw;
    public string Romaji => Kana.ToRomaji(Reading);
    public string Key => "v:" + Jp + "|" + Reading;
    public bool HasKanji => Kana.ContainsKanji(Jp);
}

public class KanjiEntry
{
    public string Char { get; set; } = "";
    public string Level { get; set; } = "";
    public string On { get; set; } = "";
    public string Kun { get; set; } = "";
    public string Meaning { get; set; } = "";
    public List<VocabItem> Words { get; set; } = new();
    public int Group { get; set; }
}

public class PhraseCategory
{
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "話";
    public List<string[]> Phrases { get; set; } = new();
    public IEnumerable<VocabItem> Items => Phrases.Where(p => p.Length >= 3).Select(p => new VocabItem(p[0], p[1], p[2], "frases:" + Name));
}

public enum ExType { Choice, Typing, Order, Listen }

/// <summary>Exercício pronto para ser exibido pelo ExerciseRunner.</summary>
public class Exercise
{
    public ExType Type { get; set; }
    public string? Context { get; set; }
    public string Prompt { get; set; } = "";
    public string? Japanese { get; set; }
    public string? JapaneseReading { get; set; }
    public string? SpeakText { get; set; }
    public List<string> Options { get; set; } = new();
    public int Answer { get; set; }
    public bool OptionsJapanese { get; set; }
    public List<string> Accepted { get; set; } = new();
    public List<string> Tiles { get; set; } = new();
    public List<string> Correct { get; set; } = new();
    public string? Explanation { get; set; }
    public string? Hint { get; set; }
    /// <summary>Chave para estatísticas (ex.: kana errado, item de vocabulário).</summary>
    public string? StatKey { get; set; }
    public bool BigJapanese { get; set; }
    /// <summary>Se true, o áudio entregaria a resposta: não toca antes de responder.</summary>
    public bool AudioRevealsAnswer { get; set; }

    public string CorrectAnswerText => Type switch
    {
        ExType.Choice or ExType.Listen => Options.Count > Answer ? Options[Answer] : "",
        ExType.Typing => Accepted.FirstOrDefault() ?? "",
        ExType.Order => string.Join(" ", Correct),
        _ => ""
    };
}
