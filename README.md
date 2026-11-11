# JapHelp — Curso de Japonês para Intercâmbio

App desktop (Windows Forms, .NET 10) com um curso de japonês do zero ao avançado, focado em quem vai fazer intercâmbio no Japão.

## Como rodar

Requer o .NET 10 SDK no Windows.

```bash
dotnet run
```

## No celular (Android e iPhone)

A pasta `mobile/` tem o JapHelp como app web instalável (PWA): mesmo conteúdo, mesmos exercícios, revisão SRS, traçado com o dedo, voz japonesa do celular, gravação da própria voz e verificação de pronúncia. Depois do primeiro acesso funciona offline. Ele lê os arquivos de `Content/` direto, então editar o conteúdo vale para o PC e para o celular.

**Publicar (uma vez):** no GitHub, Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`. O app fica em `https://<usuário>.github.io/JapHelp/mobile/`.

**Instalar no celular:** abra o link — Android (Chrome): menu ⋮ → *Instalar app*; iPhone (Safari): Compartilhar → *Adicionar à Tela de Início*.

**Testar no PC:**

```bash
powershell -ExecutionPolicy Bypass -File mobile/servir.ps1
```

e abra `http://localhost:8765/mobile/` (no Chrome, F12 → modo celular).

- O progresso fica salvo no aparelho. Em Ajustes dá para exportar/importar, inclusive o `progress.json` do app de PC.
- Ao adicionar um arquivo novo em `Content/`, inclua o nome em `mobile/js/content.js` e em `mobile/sw.js`. Ao mudar o código do app, aumente `VERSION` em `mobile/sw.js` para os celulares baixarem a versão nova.
- Para ouvir o áudio, o celular precisa de voz japonesa (Android: Serviços de fala do Google → instalar dados de voz → Japonês; iPhone: Acessibilidade → Conteúdo Falado → Vozes → Japonês). A verificação de pronúncia usa a internet.

## O que tem

- **72 lições** em 8 módulos: Fundamentos (kana), N5, N4, N3, N2 (12 lições), **Vida no Japão** (imigração, trem, konbini, prefeitura, banco, faculdade, moradia, saúde, emergências, arubaito, amizades) e **Leitura e escuta** (textos reais e áudios longos com perguntas de compreensão).
- Cada lição: teoria, vocabulário, exemplos, diálogos e exercícios (múltipla escolha, digitação em romaji → kana, montar frase, escuta).
- **Vocabulário em decks**: 746 palavras em 25 temas (N5, N4, vida no Japão), com quiz.
- **Treino de fala**: ouvir o modelo, gravar a própria voz, comparar e verificar a pronúncia (reconhecimento de fala do Windows).
- **Revisão espaçada (SRS)** do que você estuda.
- **Kana** (tabela, quiz e pontos fracos), **Kanji** (646: N5, N4, N3 e placas/avisos), **prática de escrita** por traçado.
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
| `kanji*.txt` | `kanji\|on\|kun\|significado\|palavra:leitura:significado;...` |
| `vocab_*.txt` | decks: `# Nome \| ícone \| nível` e depois `japonês\|leitura\|significado` |
| `frases.json` | frases por situação |
| `dicas.txt` | dicas do dia (uma por linha) |

Para validar o conteúdo depois de editar:

```bash
dotnet build
bin/Debug/net10.0-windows10.0.19041.0/JapHelp.exe --selftest resultado.txt
```

O progresso do aluno fica em `%APPDATA%\JapHelp\progress.json`.
