# PowerShell Clean Build Script for Cofau Android APK
# This script ensures a fresh build without cache issues

Write-Host "🧹 Cleaning build cache and artifacts..." -ForegroundColor Green
Write-Host ""

# Navigate to frontend directory
Set-Location $PSScriptRoot

# Clear Expo cache
Write-Host "1️⃣ Clearing Expo cache..." -ForegroundColor Yellow
npx expo start --clear

# Clear Metro bundler cache
Write-Host "2️⃣ Clearing Metro bundler cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .metro -ErrorAction SilentlyContinue

# Clear watchman cache (if installed)
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    Write-Host "3️⃣ Clearing Watchman cache..." -ForegroundColor Yellow
    watchman watch-del-all
}

# Clear npm/yarn cache
Write-Host "4️⃣ Clearing package manager cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    yarn cache clean
}

# Remove build artifacts
Write-Host "5️⃣ Removing old build artifacts..." -ForegroundColor Yellow
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ios -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Cache cleared successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Ready to build APK. Run one of these commands:" -ForegroundColor Cyan
Write-Host "   - npm run build:android:preview   (for preview APK)" -ForegroundColor White
Write-Host "   - npm run build:android:production (for production APK)" -ForegroundColor White
Write-Host ""
Write-Host "Or use EAS directly:" -ForegroundColor Cyan
Write-Host "   - eas build --platform android --profile preview --clear-cache" -ForegroundColor White
Write-Host ""

