<#
.SYNOPSIS
    Builds one edition of the Warraq Windows installer and proves what is (and is not) inside it.
.DESCRIPTION
    Warraq ships in two editions from the same code:

      public  Nothing from .env is compiled in. First run asks for the user's own Supabase project
              (src/sections/Setup.tsx). This is the edition that goes on GitHub Releases.

      client  The hospital's build: the project, service-role key and admin login from .env are
              baked in, so it runs with no setup. It contains secrets. Never upload it anywhere
              public; hand it over directly.

    After building, the script scans the unpacked program and web bundle for the values in .env.
    A public build that contains any of them fails, a client build that is missing them fails,
    and nothing is copied to release\ until the scan passes. Only variable names are printed,
    never values. (The installer itself is compressed, so the scan looks at what goes into it.)
.PARAMETER Edition
    'public' or 'client'.
.EXAMPLE
    pnpm build:public
    pnpm build:client
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('public', 'client')]
    [string]$Edition,

    # Skip the build and only scan what is already in src-tauri\target and dist. Nothing is copied.
    [switch]$ScanOnly
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

$version = (Get-Content (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$exe = Join-Path $ProjectRoot 'src-tauri\target\release\warraq.exe'
$dist = Join-Path $ProjectRoot 'dist'
$bundleDir = Join-Path $ProjectRoot 'src-tauri\target\release\bundle\nsis'
$outDir = Join-Path $ProjectRoot "release\$Edition"

# Values worth hunting for. Short ones (a username) would match unrelated text, so they are skipped;
# anything named like a password or key is kept down to 8 characters.
function Read-SecretValues {
    $envFile = Join-Path $ProjectRoot '.env'
    $found = [ordered]@{}
    if (-not (Test-Path $envFile)) { return $found }
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$') { continue }
        $name = $Matches[1]; $value = $Matches[2].Trim('"').Trim("'")
        $secretLike = $name -match 'PASSWORD|SECRET|KEY|TOKEN|STRING'
        if ($value.Length -ge 12 -or ($secretLike -and $value.Length -ge 8)) { $found[$name] = $value }
    }
    return $found
}

function Test-ContainsValue([byte[]]$bytes, [string]$value) {
    $text = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
    return $text.Contains($value)
}

$installer = Join-Path $bundleDir "Warraq_${version}_x64-setup.exe"

if ($ScanOnly) {
    Write-Host "Scanning the existing build as the $Edition edition (no build, nothing copied)" -ForegroundColor Cyan
} else {
    Write-Host "Building Warraq $version, $Edition edition" -ForegroundColor Cyan

    $env:WARRAQ_EDITION = $Edition
    $tauriArgs = @('tauri', 'build', '--bundles', 'nsis')
    if ($Edition -eq 'client') { $tauriArgs += @('--features', 'client') }

    & pnpm @tauriArgs
    if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }
    if (-not (Test-Path $installer)) { throw "Expected installer not found: $installer" }
}

# --- What went into the installer ---
$secrets = Read-SecretValues
if ($secrets.Count -eq 0) {
    Write-Warning "No values found in .env, so the secret scan has nothing to look for."
}
$targets = @($exe) + (Get-ChildItem $dist -Recurse -File | ForEach-Object { $_.FullName })
$hits = @{}
foreach ($file in $targets) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    foreach ($name in $secrets.Keys) {
        if (Test-ContainsValue $bytes $secrets[$name]) {
            $hits[$name] = (@($hits[$name]) + (Split-Path $file -Leaf)) | Where-Object { $_ }
        }
    }
}

Write-Host "`nSecret scan ($($secrets.Count) values from .env, $($targets.Count) files):" -ForegroundColor Cyan
foreach ($name in $secrets.Keys) {
    $where = if ($hits.ContainsKey($name)) { "found in " + (($hits[$name] | Select-Object -Unique) -join ', ') } else { 'not present' }
    Write-Host ("  {0,-24} {1}" -f $name, $where)
}

if ($Edition -eq 'public' -and $hits.Count -gt 0) {
    throw "The PUBLIC build contains values from .env ($($hits.Keys -join ', ')). It must not be released. Nothing was copied to release\."
}
if ($Edition -eq 'client' -and $secrets.Contains('SECRET_KEY') -and -not $hits.ContainsKey('SECRET_KEY')) {
    throw "The CLIENT build is missing the baked-in SECRET_KEY, so it would not run without setup. Is --features client reaching cargo?"
}

if ($ScanOnly) { Write-Host "`nScan passed for the $Edition edition." -ForegroundColor Green; return }

# --- Hand the installer over ---
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$name = if ($Edition -eq 'client') { "Warraq_${version}_client_x64-setup.exe" } else { "Warraq_${version}_x64-setup.exe" }
$dest = Join-Path $outDir $name
Copy-Item $installer $dest -Force
$hash = (Get-FileHash $dest -Algorithm SHA256).Hash
"$hash  $name" | Set-Content (Join-Path $outDir 'SHA256SUMS.txt') -Encoding ascii

Write-Host "`nDone: $dest" -ForegroundColor Green
Write-Host "SHA-256: $hash"
if ($Edition -eq 'client') {
    Write-Host "This build contains secrets. Do not upload it to GitHub or share it publicly." -ForegroundColor Yellow
}
