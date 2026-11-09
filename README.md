# JapHelp — Curso de Japonês para Intercâmbio

App desktop (Windows Forms, .NET 10) com um curso de japonês do zero ao avançado, focado em quem vai fazer intercâmbio no Japão.

## Como rodar

Requer o .NET 10 SDK no Windows.

```bash
dotnet run
```

## O que tem

- **56 lições** em 7 módulos: Fundamentos (kana), N5, N4, N3, N2 e uma trilha **Vida no Japão** (imigração, trem, konbini, prefeitura, banco, faculdade, moradia, saúde, emergências, arubaito, amizades).
- Cada lição: teoria, vocabulário, exemplos, diálogos e exercícios (múltipla escolha, digitação em romaji → kana, montar frase, escuta).
- **Revisão espaçada (SRS)** do vocabulário das lições concluídas.
- **Kana** (tabela, quiz e pontos fracos), **Kanji** (273: N5, N4 e placas/avisos), **prática de escrita** por traçado.
- **Frases úteis** (170 em 14 situações) e **dicionário** com busca em português, romaji ou japonês.

## Áudio

Usa as vozes do Windows. Para os exercícios de escuta, instale a voz japonesa:
Configurações → Hora e idioma → Idioma → Adicionar um idioma → Japonês (marque "Conversão de texto em fala").

## Editando o conteúdo

Todo o conteúdo fica em `Content/` e pode ser editado sem mexer no código:

| Arquivo | Conteúdo |
|---|---|
| `curso_*.json` | módulos e lições (teoria, vocabulário, exemplos, diálogos, exercícios) |
| `kanji.txt` | `kanji\|on\|kun\|significado\|palavra:leitura:significado;...` |
| `frases.json` | frases por situação |
| `dicas.txt` | dicas do dia (uma por linha) |

Para validar o conteúdo depois de editar:

```bash
dotnet build
bin/Debug/net10.0-windows/JapHelp.exe --selftest resultado.txt
```

O progresso do aluno fica em `%APPDATA%\JapHelp\progress.json`.
