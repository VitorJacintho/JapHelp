# Servidor local simples para testar o app de celular no navegador do PC.
# Uso:  powershell -ExecutionPolicy Bypass -File mobile\servir.ps1   e abra http://localhost:8765/mobile/
param([int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8765 }))

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$gerar = Join-Path $PSScriptRoot 'gerar.ps1'
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.txt' = 'text/plain; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'
}
& $gerar
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "JapHelp em http://localhost:$Port/mobile/  (Ctrl+C para parar)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '') { $res.Redirect('/mobile/'); $res.Close(); continue }
      # Arquivos gerados: refaz na hora, para refletir qualquer edicao no app ou em Content/.
      if ($rel -eq 'mobile/sw.js' -or $rel -eq 'mobile/js/arquivos.js') { & $gerar | Out-Null }
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
      if (-not $path.StartsWith($root) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
      } else {
        $bytes = [IO.File]::ReadAllBytes($path)
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      }
    } catch { Write-Host "Erro em $($ctx.Request.Url): $_"; try { $res.StatusCode = 500 } catch {} }
    $res.Close()
  }
} finally { $listener.Stop() }
