# Servidor local simples para testar o app de celular no navegador do PC.
# Uso:  powershell -ExecutionPolicy Bypass -File mobile\servir.ps1   e abra http://localhost:8765/mobile/
param([int]$Port = 8765)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.txt' = 'text/plain; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'
}
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
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
      if (-not $path.StartsWith($root) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
      } else {
        $bytes = [IO.File]::ReadAllBytes($path)
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch { $res.StatusCode = 500 }
    $res.Close()
  }
} finally { $listener.Stop() }
