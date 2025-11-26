# Complete APK Build Script for Cofau
# This script handles bundle generation and APK building

Write-Host "🚀 Starting APK Build Process..." -ForegroundColor Green
Write-Host ""

# Navigate to frontend directory
Set-Location $PSScriptRoot

Write-Host "1️⃣ Generating JavaScript Bundle..." -ForegroundColor Yellow
npx expo export --platform android --output-dir android/app/src/main/assets

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Bundle generation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Bundle generated successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "2️⃣ Building Release APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat bundleReleaseJsAndAssets assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ APK build failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative build method..." -ForegroundColor Yellow
    .\gradlew.bat clean
    .\gradlew.bat assembleRelease
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ APK Build Successful!" -ForegroundColor Green
    Write-Host ""
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $apkPath) {
        $apkInfo = Get-Item $apkPath
        Write-Host "📦 APK Location:" -ForegroundColor Cyan
        Write-Host "   $($apkInfo.FullName)" -ForegroundColor White
        Write-Host ""
        Write-Host "📊 APK Details:" -ForegroundColor Cyan
        Write-Host "   Size: $([math]::Round($apkInfo.Length / 1MB, 2)) MB" -ForegroundColor White
        Write-Host "   Created: $($apkInfo.LastWriteTime)" -ForegroundColor White
    }
} else {
    Write-Host "❌ APK build failed. Check the error messages above." -ForegroundColor Red
    exit 1
}

