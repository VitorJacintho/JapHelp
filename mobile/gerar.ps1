# Gera a lista de arquivos e a versão do app de celular. Ninguém precisa rodar isto à mão:
# o servir.ps1 roda ao servir os arquivos e o GitHub roda antes de publicar (.github/workflows/pages.yml).
#
# Saídas (não vão para o git):
#   mobile/js/arquivos.js  lista dos arquivos de Content/ e a versão
#   mobile/sw.js           service worker, montado a partir de sw-modelo.js
#
# A versão é um resumo (hash) de todos os arquivos: mudou qualquer coisa, muda a versão,
# e os celulares recebem o aviso de versão nova.
$ErrorActionPreference = 'Stop'

$mobile = (Resolve-Path $PSScriptRoot).Path
$root = (Resolve-Path (Join-Path $mobile '..')).Path
$contentDir = Join-Path $root 'Content'

function Get-Relative([string]$base, [string]$full) {
  return $full.Substring($base.Length).TrimStart('\', '/').Replace('\', '/')
}

function Sort-Ordinal([string[]]$items) {
  $arr = [string[]]@($items)
  [Array]::Sort($arr, [StringComparer]::Ordinal)
  return , $arr
}

# Arquivos do app que vão para o cache offline (fora: scripts, testes e os próprios arquivos gerados).
$skipDirs = @('testes', 'ferramentas')
$skipFiles = @('sw.js', 'sw-modelo.js', 'js/arquivos.js')
$appFiles = Sort-Ordinal @(
  Get-ChildItem -Path $mobile -Recurse -File |
    ForEach-Object { Get-Relative $mobile $_.FullName } |
    Where-Object {
      $first = $_.Split('/')[0]
      $isPage = $_ -eq 'index.html'
      $isTool = $_.EndsWith('.ps1') -or $_.EndsWith('.md') -or ($_.EndsWith('.html') -and -not $isPage)
      -not ($skipDirs -contains $first) -and -not ($skipFiles -contains $_) -and -not $isTool
    }
)

# arquivos.js entra no cache, mas fica fora do hash (ele mesmo guarda a versão).
$cacheFiles = Sort-Ordinal (@($appFiles) + @('js/arquivos.js'))

$contentFiles = Sort-Ordinal @(
  Get-ChildItem -Path $contentDir -File |
    Where-Object { $_.Extension -eq '.json' -or $_.Extension -eq '.txt' } |
    ForEach-Object { $_.Name }
)

# Versão = hash do nome e do conteúdo de cada arquivo (o modelo do service worker incluído).
$sha = [Security.Cryptography.SHA256]::Create()
$hashInputs = @($appFiles | ForEach-Object { , @("mobile/$_", (Join-Path $mobile $_)) }) +
  @($contentFiles | ForEach-Object { , @("Content/$_", (Join-Path $contentDir $_)) }) +
  @(, @('mobile/sw-modelo.js', (Join-Path $mobile 'sw-modelo.js')))
foreach ($pair in $hashInputs) {
  $name = [Text.Encoding]::UTF8.GetBytes($pair[0] + "`n")
  [void]$sha.TransformBlock($name, 0, $name.Length, $null, 0)
  $bytes = [IO.File]::ReadAllBytes($pair[1])
  [void]$sha.TransformBlock($bytes, 0, $bytes.Length, $null, 0)
}
[void]$sha.TransformFinalBlock([byte[]]@(), 0, 0)
$version = -join ($sha.Hash[0..5] | ForEach-Object { $_.ToString('x2') })

function To-JsArray([string[]]$items, [string]$prefix) {
  if ($items.Count -eq 0) { return '[]' }
  return "[`n" + (($items | ForEach-Object { "  '$prefix$_'," }) -join "`n") + "`n]"
}

$utf8 = New-Object Text.UTF8Encoding $false
$header = '// GERADO por mobile/gerar.ps1 - nao edite a mao.'

$arquivos = @(
  $header
  "export const VERSION = '$version';"
  "export const CONTENT_FILES = $(To-JsArray $contentFiles '');"
  ''
) -join "`n"
$arquivosPath = Join-Path $mobile 'js/arquivos.js'

$modelo = [IO.File]::ReadAllText((Join-Path $mobile 'sw-modelo.js'), $utf8)
$gerado = @(
  "const VERSION = 'japhelp-$version';"
  "const APP_FILES = $(To-JsArray (@('') + $cacheFiles) './');"
  "const CONTENT_FILES = $(To-JsArray $contentFiles '../Content/');"
) -join "`n"
$sw = $header + "`n" + $modelo.Replace('/* GERADO */', $gerado)
$swPath = Join-Path $mobile 'sw.js'

# Só reescreve se mudou (evita mexer na data dos arquivos à toa).
foreach ($out in @(@($arquivosPath, $arquivos), @($swPath, $sw))) {
  $old = if (Test-Path $out[0]) { [IO.File]::ReadAllText($out[0], $utf8) } else { '' }
  if ($old -ne $out[1]) { [IO.File]::WriteAllText($out[0], $out[1], $utf8) }
}
Write-Output "JapHelp versao $version - $($cacheFiles.Count) arquivos do app, $($contentFiles.Count) de conteudo"
