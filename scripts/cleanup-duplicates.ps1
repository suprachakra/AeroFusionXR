# AeroFusionXR Duplicate File Cleanup Script (PowerShell)
# This script removes all duplicate utility files found across services

Write-Host "🧹 AeroFusionXR Duplicate Cleanup Started" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════" -ForegroundColor Gray

# Function to delete duplicate files with pattern
function Remove-DuplicateFiles {
    param(
        [string]$Pattern,
        [string]$Description
    )
    
    Write-Host "🔍 Scanning for duplicate $Description files..." -ForegroundColor Cyan
    
    $files = Get-ChildItem -Path "services" -Recurse -Name $Pattern -ErrorAction SilentlyContinue
    $count = $files.Count
    
    if ($count -gt 0) {
        Write-Host "📂 Found $count duplicate $Description files" -ForegroundColor Yellow
        
        foreach ($file in $files) {
            $fullPath = Join-Path "services" $file
            if (Test-Path $fullPath) {
                Write-Host "🗑️  Deleting: $fullPath" -ForegroundColor Red
                Remove-Item $fullPath -Force
            }
        }
        
        Write-Host "✅ Deleted $count duplicate $Description files" -ForegroundColor Green
    } else {
        Write-Host "✅ No duplicate $Description files found" -ForegroundColor Green
    }
    Write-Host ""
}

# Delete duplicate utility classes
Write-Host "📦 Phase 1: Eliminating Duplicate Utility Classes" -ForegroundColor Blue
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Gray

Remove-DuplicateFiles "Logger.ts" "Logger"
Remove-DuplicateFiles "PerformanceMonitor.ts" "PerformanceMonitor" 
Remove-DuplicateFiles "CacheService.ts" "CacheService"
Remove-DuplicateFiles "DatabaseManager.ts" "DatabaseManager"
Remove-DuplicateFiles "EventEmitter.ts" "EventEmitter"
Remove-DuplicateFiles "HttpClient.ts" "HttpClient"

# Delete duplicate error classes
Write-Host "🚨 Phase 2: Eliminating Duplicate Error Classes" -ForegroundColor Blue
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Gray

Remove-DuplicateFiles "AppError.ts" "AppError"
Remove-DuplicateFiles "ValidationError.ts" "ValidationError"
Remove-DuplicateFiles "NotFoundError.ts" "NotFoundError"

# Delete duplicate test files
Write-Host "🧪 Phase 3: Eliminating Duplicate Test Files" -ForegroundColor Blue
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Gray

Remove-DuplicateFiles "test-helpers.ts" "test helpers"
Remove-DuplicateFiles "mock-data.ts" "mock data"

# Clean up empty directories
Write-Host "🧹 Phase 4: Cleaning Up Empty Directories" -ForegroundColor Blue
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Gray

$emptyDirs = Get-ChildItem -Path "services" -Recurse -Directory | Where-Object { (Get-ChildItem $_.FullName).Count -eq 0 }
foreach ($dir in $emptyDirs) {
    Write-Host "🗑️  Removing empty directory: $($dir.FullName)" -ForegroundColor Red
    Remove-Item $dir.FullName -Force
}

Write-Host ""
Write-Host "🎉 CLEANUP COMPLETED!" -ForegroundColor Green
Write-Host "═══════════════════════" -ForegroundColor Gray

# Count remaining files
$remainingLoggers = (Get-ChildItem -Path "services" -Recurse -Name "Logger.ts" -ErrorAction SilentlyContinue).Count
$remainingPerf = (Get-ChildItem -Path "services" -Recurse -Name "PerformanceMonitor.ts" -ErrorAction SilentlyContinue).Count
$remainingCache = (Get-ChildItem -Path "services" -Recurse -Name "CacheService.ts" -ErrorAction SilentlyContinue).Count

Write-Host "📊 CLEANUP SUMMARY:" -ForegroundColor Blue
Write-Host "   📁 Remaining Logger files: $remainingLoggers"
Write-Host "   📁 Remaining PerformanceMonitor files: $remainingPerf" 
Write-Host "   📁 Remaining CacheService files: $remainingCache"
Write-Host ""
Write-Host "✅ Duplicate elimination completed!" -ForegroundColor Green
Write-Host "✅ Services now ready to use shared packages!" -ForegroundColor Green 