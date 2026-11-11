# Extrai a ordem dos traços do KanjiVG para os caracteres do curso e salva em mobile/data/tracos.json.
# Rode de novo quando entrarem kanji novos em Content/kanji*.txt:
#   powershell -ExecutionPolicy Bypass -File mobile\ferramentas\kanjivg.ps1
# Sem parâmetro, baixa a versão mais recente do KanjiVG do GitHub (arquivo .xml.gz, ~4 MB).
#
# KanjiVG: Copyright (C) Ulrich Apel, licença Creative Commons Attribution-Share Alike 3.0
# (https://kanjivg.tagaini.net). O tracos.json é derivado dele e segue a mesma licença.
param([string]$Xml = '')
$ErrorActionPreference = 'Stop'

$mobile = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$root = (Resolve-Path (Join-Path $mobile '..')).Path

# ---- caracteres necessários: kana (com dakuten e pequenos) + kanji do curso
$chars = New-Object 'System.Collections.Generic.HashSet[int]'
foreach ($range in @(@(0x3041, 0x3096), @(0x30A1, 0x30FA))) {
  for ($c = $range[0]; $c -le $range[1]; $c++) { [void]$chars.Add($c) }
}
[void]$chars.Add(0x30FC) # ー
$utf8 = New-Object Text.UTF8Encoding $false
foreach ($f in Get-ChildItem (Join-Path $root 'Content') -Filter 'kanji*.txt') {
  foreach ($line in [IO.File]::ReadAllLines($f.FullName, $utf8)) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#') -or $t.StartsWith('//')) { continue }
    $k = $t.Split('|')[0].Trim()
    if ($k.Length -ge 1) { [void]$chars.Add([char]::ConvertToUtf32($k, 0)) }
  }
}

# ---- arquivo do KanjiVG
if ($Xml -eq '') {
  $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/KanjiVG/kanjivg/releases/latest' -Headers @{ 'User-Agent' = 'kanjivg-extract' }
  $asset = $rel.assets | Where-Object { $_.name -like '*.xml.gz' } | Select-Object -First 1
  $Xml = Join-Path ([IO.Path]::GetTempPath()) $asset.name
  if (-not (Test-Path $Xml)) {
    Write-Output "Baixando $($asset.name)..."
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $Xml -UseBasicParsing
  }
}

$file = [IO.File]::OpenRead($Xml)
$stream = if ($Xml.EndsWith('.gz')) { New-Object IO.Compression.GZipStream($file, [IO.Compression.CompressionMode]::Decompress) } else { $file }
$reader = New-Object Xml.XmlTextReader($stream)
$reader.Namespaces = $false
$reader.DtdProcessing = [Xml.DtdProcessing]::Ignore

# ---- lê cada <kanji id="kvg:kanji_XXXXX"> e guarda os traços (<path id="...-sN" d="...">) em ordem
$result = New-Object 'System.Collections.Generic.SortedDictionary[int,string[]]'
$current = -1
$strokes = $null
while ($reader.Read()) {
  if ($reader.NodeType -eq [Xml.XmlNodeType]::Element) {
    if ($reader.Name -eq 'kanji') {
      $id = $reader.GetAttribute('id')
      $current = -1
      if ($id -match '^kvg:kanji_([0-9a-f]{5})$') {
        $cp = [Convert]::ToInt32($Matches[1], 16)
        if ($chars.Contains($cp)) { $current = $cp; $strokes = New-Object 'System.Collections.Generic.SortedDictionary[int,string]' }
      }
    } elseif ($reader.Name -eq 'path' -and $current -ge 0) {
      $pathId = $reader.GetAttribute('id')
      if ($pathId -match '-s(\d+)$') { $strokes[[int]$Matches[1]] = $reader.GetAttribute('d') }
    }
  } elseif ($reader.NodeType -eq [Xml.XmlNodeType]::EndElement -and $reader.Name -eq 'kanji' -and $current -ge 0) {
    $result[$current] = [string[]]@($strokes.Values)
    $current = -1
  }
}
$reader.Close()

# ---- salva: { "日": ["M...", "M...", ...], ... } (caminhos SVG numa caixa de 109x109)
$sb = New-Object Text.StringBuilder
[void]$sb.Append("{`n")
$first = $true
foreach ($kv in $result.GetEnumerator()) {
  if (-not $first) { [void]$sb.Append(",`n") }
  $first = $false
  $ch = [char]::ConvertFromUtf32($kv.Key)
  $paths = ($kv.Value | ForEach-Object { '"' + ($_ -replace '\s+', ' ').Trim() + '"' }) -join ','
  [void]$sb.Append("""$ch"":[$paths]")
}
[void]$sb.Append("`n}`n")
$out = Join-Path $mobile 'data/tracos.json'
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
[IO.File]::WriteAllText($out, $sb.ToString(), $utf8)

$missing = @($chars | Where-Object { -not $result.ContainsKey($_) } | ForEach-Object { [char]::ConvertFromUtf32($_) })
Write-Output "tracos.json: $($result.Count) caracteres, $([Math]::Round((Get-Item $out).Length / 1KB)) KB"
if ($missing.Count) { Write-Output "Sem dados no KanjiVG: $($missing -join ' ')" }
