# Installation script for Share Feature (PowerShell)
Write-Host "🚀 Installing Share Feature Dependencies..." -ForegroundColor Cyan

# Install npm packages
Write-Host "📦 Installing npm packages..." -ForegroundColor Yellow
npm install react-native-view-shot expo-sharing expo-file-system

# Check if installation was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✨ Installation complete!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📖 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run 'expo prebuild' if using Expo"
    Write-Host "2. Run 'npm run android' or 'npm run ios' to rebuild"
    Write-Host "3. Check SHARE_FEATURE_README.md for usage instructions"
    Write-Host ""
} else {
    Write-Host "❌ Installation failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}
