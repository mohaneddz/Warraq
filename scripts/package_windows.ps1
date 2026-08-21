<#
.SYNOPSIS
    Packaging script for Warraq Library Management System (Windows 10, 11).
.DESCRIPTION
    Validates the codebase (TypeScript, Vitest, Rust) and packages the Tauri application
    for specified target Windows versions with checksum generation.

    Windows 7 is NOT a supported target. As of Rust 1.78 (May 2024), std raised its minimum
    supported Windows version to Windows 10 - a binary built with any current toolchain will
    fail to launch on Windows 7 (this is what the hospital hit last time). Verified 2026-08-21:
    even pinning rustc back to 1.77.2 (the last Win7-capable release) does not fix it, because
    the current Tauri 2.11 dependency tree pulls in transitive crates requiring `edition2024`,
    which 1.77's cargo cannot even parse. Real Win7 support would mean downgrading Tauri and
    every plugin (stronghold, autostart, global-shortcut, ...) to mid-2024-era releases - a
    project of its own, not a packaging flag. If that's ever revisited, start there.
.PARAMETER TargetOS
    Target OS profile: 'win10', 'win11', or 'all' (default: 'all').
.PARAMETER Arch
    Target architecture: 'x64' or 'x86' (default: 'x64').
.PARAMETER SkipVerification
    Skip pre-build code checks (typecheck, tests, rust check).
.PARAMETER Clean
    Clean the release output directory before packaging.
#>

[CmdletBinding()]
param(
    [ValidateSet('win10', 'win11', 'all')]
    [string]$TargetOS = 'all',

    [ValidateSet('x64', 'x86')]
    [string]$Arch = 'x64',

    [switch]$SkipVerification,

    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   WARRAQ desktop packaging workflow for Windows" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Target OS Profile : $TargetOS" -ForegroundColor Yellow
Write-Host "Architecture Mode : $Arch" -ForegroundColor Yellow
Write-Host "Skip Verification : $SkipVerification" -ForegroundColor Yellow
Write-Host "Clean Output      : $Clean" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot
$DistRelease = Join-Path $ProjectRoot "release"

if ($Clean -and (Test-Path $DistRelease)) {
    Write-Host "Cleaning existing release directory..." -ForegroundColor Yellow
    Remove-Item -Path $DistRelease -Recurse -Force
}

# 1. PREREQUISITE & ENVIRONMENT SANITY CHECKS
Write-Host "`n[1/4] Checking environment dependencies..." -ForegroundColor Green

function Check-Command($cmdName, $helpMessage) {
    if (-not (Get-Command $cmdName -ErrorAction SilentlyContinue)) {
        Write-Error "Missing required dependency: '$cmdName'. $helpMessage"
        exit 1
    }
}

Check-Command "node" "Please install Node.js (v18+)."
Check-Command "pnpm" "Please install pnpm (npm i -g pnpm)."
Check-Command "cargo" "Please install Rust toolchain (https://rustup.rs)."
Check-Command "rustup" "Please ensure rustup is available."

# Determine architectures to target
function Ensure-RustTarget($targetTriple) {
    Write-Host "Checking Rust target triple '$targetTriple'..." -ForegroundColor Gray
    $targets = & rustup target list --installed
    if ($targets -notcontains $targetTriple) {
        Write-Host "Installing missing Rust target '$targetTriple'..." -ForegroundColor Yellow
        & rustup target add $targetTriple
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install target '$targetTriple'."
            exit 1
        }
    }
}

# 2. CODE VERIFICATION SUITE
if (-not $SkipVerification) {
    Write-Host "`n[2/4] Running code verification suite..." -ForegroundColor Green

    Write-Host " -> Running TypeScript typecheck (pnpm typecheck)..." -ForegroundColor Gray
    & pnpm typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Error "TypeScript typecheck failed. Please resolve type errors before packaging."
        exit 1
    }

    Write-Host " -> Running frontend unit tests (pnpm test)..." -ForegroundColor Gray
    & pnpm test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Unit tests failed. Please resolve failing tests before packaging."
        exit 1
    }

    Write-Host " -> Running Rust compilation check (pnpm rust:check)..." -ForegroundColor Gray
    & pnpm rust:check
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Rust check failed. Please resolve Rust compilation errors before packaging."
        exit 1
    }

    Write-Host "Verification suite passed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Skipping code verification as requested." -ForegroundColor Yellow
}

# 3. BUILD & PACKAGING EXECUTIONS
Write-Host "`n[3/4] Building production assets and packaging installers..." -ForegroundColor Green

# Frontend bundle
Write-Host " -> Building web assets (pnpm build)..." -ForegroundColor Gray
& pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend web build failed."
    exit 1
}

# Helper to build Tauri binary for a specific target
function Build-TauriTarget($targetOSName, $rustTargetTriple, $outputSubdir) {
    Write-Host "`n---> Building package for [$targetOSName] target triple '$rustTargetTriple'..." -ForegroundColor Cyan

    Ensure-RustTarget $rustTargetTriple

    & pnpm tauri build --target $rustTargetTriple
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Tauri build failed for target '$rustTargetTriple'."
        exit 1
    }

    $targetDir = Join-Path $DistRelease $outputSubdir
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # Locate generated installers in target/release/bundle or target/<triple>/release/bundle
    $bundlePath = Join-Path $ProjectRoot "src-tauri\target\$rustTargetTriple\release\bundle"
    if (-not (Test-Path $bundlePath)) {
        $bundlePath = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
    }

    if (Test-Path $bundlePath) {
        $installers = Get-ChildItem -Path $bundlePath -Recurse -Include *.exe, *.msi | Where-Object { $_.DirectoryName -notmatch "nsis-x86-unicode" }
        foreach ($file in $installers) {
            $dest = Join-Path $targetDir $file.Name
            Copy-Item -Path $file.FullName -Destination $dest -Force
            Write-Host "      Copied installer: $($file.Name) -> $outputSubdir" -ForegroundColor Green
        }
    } else {
        Write-Warning "Could not find bundle output at '$bundlePath'."
    }
}

# Create target executions
$targetsToBuild = @()

if ($TargetOS -eq 'win10' -or $TargetOS -eq 'all') {
    if ($Arch -eq 'x86') {
        $targetsToBuild += @{ OS = 'Windows 10 (32-bit)'; Triple = 'i686-pc-windows-msvc'; Folder = 'win10' }
    } else {
        $targetsToBuild += @{ OS = 'Windows 10 (64-bit)'; Triple = 'x86_64-pc-windows-msvc'; Folder = 'win10' }
    }
}

if ($TargetOS -eq 'win11' -or $TargetOS -eq 'all') {
    $targetsToBuild += @{ OS = 'Windows 11 (64-bit)'; Triple = 'x86_64-pc-windows-msvc'; Folder = 'win11' }
}

# Filter out duplicate (OS, Triple, Folder) combos
$uniqueTargets = @()
foreach ($t in $targetsToBuild) {
    $existing = $uniqueTargets | Where-Object { $_.Triple -eq $t.Triple -and $_.Folder -eq $t.Folder }
    if (-not $existing) {
        $uniqueTargets += $t
    }
}

foreach ($target in $uniqueTargets) {
    Build-TauriTarget $target.OS $target.Triple $target.Folder
}

# 4. POST-PROCESSING & CHECKSUM GENERATION
Write-Host "`n[4/4] Generating checksums and release metadata..." -ForegroundColor Green

$releaseSubdirs = Get-ChildItem -Path $DistRelease -Directory -ErrorAction SilentlyContinue
foreach ($dir in $releaseSubdirs) {
    $files = Get-ChildItem -Path $dir.FullName -Include *.exe, *.msi -Recurse
    if ($files) {
        $checksumFile = Join-Path $dir.FullName "SHA256SUMS.txt"
        $checksumLines = @()
        foreach ($f in $files) {
            $hash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash
            $checksumLines += "$hash  $($f.Name)"
        }
        $checksumLines | Set-Content -Path $checksumFile -Encoding UTF8
        Write-Host "Generated SHA256 checksums for $($dir.Name): $checksumFile" -ForegroundColor Gray
    }
}

# Windows 7 is not a supported target (see script header) - no prerequisite guide is generated.

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "   Packaging completed successfully!" -ForegroundColor Green
Write-Host "   Release outputs located at: $DistRelease" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
