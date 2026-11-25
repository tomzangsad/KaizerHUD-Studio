# KaizerHUD Studio - tiny local web server for dev_kaizerhud.bat
# Serves the ui folder at http://localhost:8765/ so the debug app always shows the files on disk
# (press F5 in the app after editing). Only answers this computer (localhost). Close the window to stop.
param([string]$Root = (Join-Path $PSScriptRoot 'ui'), [int]$Port = 8765)

$Host.UI.RawUI.WindowTitle = 'KaizerHUD UI server'
$Root = (Resolve-Path $Root).Path.TrimEnd('\')
$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
    '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
    '.ttf' = 'font/ttf'; '.otf' = 'font/otf'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Host "Port $Port is already in use (an old server window may still be open) - that one is used instead."
    Start-Sleep -Seconds 5
    exit 0
}
Write-Host "KaizerHUD UI server: http://localhost:$Port/"
Write-Host "Folder: $Root"
Write-Host 'Keep this window open while testing. Close it to stop.'

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
        $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/').Replace('/', '\')
        if ($rel -eq '') { $rel = 'index.html' }
        $path = [IO.Path]::GetFullPath((Join-Path $Root $rel))
        # never serve anything outside the ui folder
        if (-not $path.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($path)) {
            $res.StatusCode = 404
        } else {
            $ext = [IO.Path]::GetExtension($path).ToLower()
            if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
            $res.AddHeader('Cache-Control', 'no-store')
            $bytes = [IO.File]::ReadAllBytes($path)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        try { $res.StatusCode = 500 } catch {}
    } finally {
        try { $res.Close() } catch {}
    }
}
