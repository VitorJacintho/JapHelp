# JapHelp — Curso de Japonês para Intercâmbio

App desktop (Windows Forms, .NET 10) com um curso de japonês do zero ao avançado, focado em quem vai fazer intercâmbio no Japão.

## Como rodar

Requer o .NET 10 SDK no Windows.

```bash
dotnet run
```

## No celular (Android e iPhone)

A pasta `mobile/` tem o JapHelp como app web instalável (PWA): mesmo conteúdo, mesmos exercícios, revisão SRS, furigana em cima dos kanji, escrita com o dedo conferindo a ordem dos traços, voz japonesa do celular, gravação da própria voz e verificação de pronúncia. Depois do primeiro acesso funciona offline. Ele lê os arquivos de `Content/` direto, então editar o conteúdo vale para o PC e para o celular.

**Publicar (uma vez):** no GitHub, Settings → Pages → Source: *GitHub Actions*. A cada push na `main`, o GitHub gera a lista de arquivos, roda os testes e publica (`.github/workflows/pages.yml`). O app fica em `https://<usuário>.github.io/JapHelp/mobile/`.

**Instalar no celular:** abra o link — Android (Chrome): menu ⋮ → *Instalar app*; iPhone (Safari): Compartilhar → *Adicionar à Tela de Início*. Quando sair versão nova, o app mostra "Nova versão disponível — Atualizar".

**Testar no PC:**

```bash
powershell -ExecutionPolicy Bypass -File mobile/servir.ps1
```

e abra `http://localhost:8765/mobile/` (no Chrome, F12 → modo celular). Use `http://localhost:8765/mobile/?nosw` para desligar o cache offline enquanto edita o código. Os testes ficam em `http://localhost:8765/mobile/testes/`.

- **Nada de lista manual:** a lista de arquivos e a versão são geradas por `mobile/gerar.ps1` (o `servir.ps1` e o GitHub rodam sozinhos). Arquivos novos em `Content/` entram automaticamente.
- **Progresso:** fica salvo no aparelho. O app pede ao navegador para não apagar os dados e lembra de fazer backup a cada 14 dias. Em Ajustes, "Fazer backup" abre o menu de compartilhar do celular (Drive, WhatsApp, e-mail). O arquivo serve também no PC (renomeie para `progress.json` em `%APPDATA%\JapHelp\`), e o `progress.json` do PC pode ser importado no celular.
- **Escrita:** três níveis — Fácil (modelo com a ordem dos traços numerada), Médio (modelo sem números) e Difícil (quadro vazio, de memória). Ao terminar, o app aponta traço fora de ordem, sentido invertido ou forma diferente. A ordem dos traços vem do [KanjiVG](https://kanjivg.tagaini.net) (© Ulrich Apel, CC BY-SA 3.0), extraída para `mobile/data/tracos.json` (todo kanji que aparece em `Content/`); com kanji novos, rode `mobile/ferramentas/kanjivg.ps1`.
- **Escrita na revisão:** em Revisar → "Escrever os kanji", o app mostra o significado e a leitura, você escreve o kanji de memória e ele confere; no modo Português → japonês os kanji também viram cartões de escrita.
- **Tocar na palavra:** nos exemplos, diálogos, frases e textos, tocar numa palavra mostra leitura, significado, áudio e um botão para pôr na revisão (reconhece partículas e formas como 食べました, 待ってください). Pode desligar em Ajustes.
- **Estatísticas:** na tela inicial, "Ver estatísticas" mostra XP por dia (4 semanas, com a meta), revisões previstas para os próximos 7 dias, a coleção por estágio e o que você mais erra.
- **Tamanho do texto:** em Ajustes, Normal / Grande / Maior / Enorme para o japonês e a furigana.
- **Treinos gerados:** em Praticar → Treinos, exercícios criados na hora a partir do vocabulário e das frases do curso: conjugação (ます, dicionário, て, た, ない e adjetivos), preços, horas e datas (com as leituras irregulares), partículas e ditado.
- **Mostrar para alguém:** nas Frases úteis, o botão 🔎 abre a frase em tela cheia, com letras grandes, para mostrar a um atendente.
- **Minhas palavras:** em Praticar → Minhas palavras, cadastre palavras da aula ou da rua (aceita romaji); elas entram na revisão.
- **Plano do dia:** na tela inicial, quatro tarefas curtas (revisões, próxima lição, um treino que muda a cada dia e 5 kanji para escrever), com ✓ quando feitas.
- **Simulado JLPT:** em Praticar → Simulado JLPT, uma prova N5 ou N4 com tempo (25 ou 30 min), sem correção durante a prova e com a nota de cada seção no fim (vocabulário e kanji, gramática, leitura e audição). É uma estimativa, montada com o conteúdo do curso.
- **Aprender as palavras:** na aba Vocabulário de cada lição (e em cada deck), as palavras viram grupos de 4. Cada grupo apresenta uma palavra por vez — leitura, letra por letra, o significado dos kanji, dicas de pronúncia (っ, vogais longas) e um exemplo — e pergunta logo depois; no fim, escrever a palavra montando as letras ("escreva amor" → あい), completar e montar uma frase com ela e falar. Nos níveis 0 a 2 é o passo recomendado antes dos exercícios. Grupo com 60%+ ganha ✓ e as palavras entram na revisão.
- **Falar no microfone:** as sessões das lições trazem questões para responder em voz alta (ler a palavra, ouvir e repetir), e em Praticar → Treinos → Falar há rodadas de ler kana, ler kanji, "diga em japonês" e ouvir e repetir. O app aceita o que o celular escrever em kanji (青 conta como あお). Sem microfone na hora, "Estou sem microfone" pula as questões de fala até fechar o app; para desligar de vez, Ajustes → "Exercícios de falar".
- **Furigana que some:** em Ajustes, a opção "Esconder a furigana dos kanji que já domino" tira a leitura dos kanji com 14+ dias na revisão.
- **Testes:** `mobile/testes/` confere conteúdo, exercícios, furigana, traços, arquivos do modo offline e se o celular dá os mesmos resultados do PC (conversão de kana, correção de respostas, SRS, furigana e conferência dos traços). As respostas do PC ficam em `mobile/testes/paridade.json`; ao mudar `Core/Kana.cs`, `Core/Furigana.cs`, `Core/Strokes.cs` ou o SRS, gere de novo com `JapHelp.exe --paridade mobile/testes/paridade.json`.
- Para ouvir o áudio, o celular precisa de voz japonesa (Android: Serviços de fala do Google → instalar dados de voz → Japonês; iPhone: Acessibilidade → Conteúdo Falado → Vozes → Japonês). A verificação de pronúncia usa a internet.

## O que tem

- **77 lições** em 8 módulos: Fundamentos (kana), N5, N4, N3, N2 (12 lições), **Vida no Japão** (imigração, trem, konbini, prefeitura, banco, faculdade, moradia, saúde, emergências, arubaito, amizades) e **Leitura e escuta** (textos reais e áudios longos com perguntas de compreensão).
- Cada lição: teoria, vocabulário, exemplos, diálogo e exercícios (múltipla escolha, digitação em romaji → kana, montar frase, escuta). No celular, a sessão também traz exercícios gerados com as frases da lição: montar frase, completar partícula, conjugar e ditado.
- **Vocabulário em decks**: 1.016 palavras em 34 temas (N5, N4, N3, vida no Japão), com quiz.
- **Treino de fala**: ouvir o modelo, gravar a própria voz, comparar e verificar a pronúncia (reconhecimento de fala do Windows).
- **Revisão espaçada (SRS)** do que você estuda, com **furigana** (leitura em cima dos kanji) nos cartões, exemplos e textos.
- **Kana** (tabela, quiz e pontos fracos), **Kanji** (975: N5, N4, N3, placas/avisos e todos os outros que aparecem no curso), **prática de escrita** em 3 níveis (com números, sem números, de memória) que confere a ordem e o sentido dos traços.
- **Frases úteis** (170 em 14 situações) e **dicionário** com busca em português, romaji ou japonês.

## Áudio e fala

Usa as vozes modernas do Windows (WinRT), com escolha de voz e velocidade em Configurações.
Para ouvir e para verificar a pronúncia, instale o japonês:
Configurações → Hora e idioma → Idioma → Adicionar um idioma → Japonês (marque "Conversão de texto em fala" e "Reconhecimento de fala").
A tela de Configurações tem um diagnóstico que mostra o que está instalado.

## Editando o conteúdo

Todo o conteúdo fica em `Content/` e pode ser editado sem mexer no código:

| Arquivo | Conteúdo |
|---|---|
| `curso_*.json` | módulos e lições (teoria, texto, vocabulário, exemplos, diálogos, exercícios) |
| `kanji*.txt` | `kanji\|on\|kun\|significado\|palavra:leitura:significado;...` (`kanji_extra.txt` traz os kanji do curso que não estão nas listas por nível; um teste avisa se faltar algum) |
| `vocab_*.txt` | decks: `# Nome \| ícone \| nível` e depois `japonês\|leitura\|significado` |
| `frases.json` | frases por situação |
| `dicas.txt` | dicas do dia (uma por linha) |

Para validar o conteúdo depois de editar:

```bash
dotnet build
bin/Debug/net10.0-windows10.0.19041.0/JapHelp.exe --selftest resultado.txt
```

O progresso do aluno fica em `%APPDATA%\JapHelp\progress.json`. Em Configurações → Dados dá para exportar e importar o progresso (o mesmo arquivo serve no celular).
