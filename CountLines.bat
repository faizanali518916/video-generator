@echo off
powershell -NoProfile -Command ^
"$files = Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js,*.jsx -File ^| Where-Object { $_.FullName -notmatch '\\.next\\' -and $_.FullName -notmatch '\\.vscode\\' -and $_.FullName -notmatch '\\node_modules\\' }; ^
$table = @(); ^
$totalLines = 0; ^
$totalFiles = $files.Count; ^
$counter = 0; ^
foreach ($file in $files) { ^
    $counter++; ^
    $percent = [math]::Round(($counter / $totalFiles) * 100); ^
    Write-Progress -Activity 'Counting lines' -Status ('Processing {0} of {1} files' -f $counter, $totalFiles) -PercentComplete $percent; ^
    $lineCount = (Get-Content $file.FullName -ErrorAction SilentlyContinue).Count; ^
    $table += [PSCustomObject]@{ File = $file.FullName.Substring((Get-Location).Path.Length); Lines = $lineCount }; ^
    $totalLines += $lineCount; ^
}; ^
$top50 = $table ^| Sort-Object Lines -Descending ^| Select-Object -First 50; ^
Write-Host ''; ^
Write-Host '--- TOP 50 LARGEST FILES ---' -ForegroundColor Magenta; ^
Write-Host ('{0,-80} {1,10}' -f 'File', 'Lines') -ForegroundColor Cyan; ^
Write-Host ('{0,-80} {1,10}' -f '----', '-----') -ForegroundColor Cyan; ^
foreach ($row in $top50) { ^
    if ($row.Lines -gt 500) { $color='Red' } ^
    elseif ($row.Lines -gt 300) { $color='Yellow' } ^
    else { $color='White' } ^
    Write-Host ('{0,-80} {1,10}' -f $row.File, $row.Lines) -ForegroundColor $color; ^
}; ^
Write-Host ''; ^
Write-Host ('TOTAL FILES: {0:N0}' -f $totalFiles) -ForegroundColor Cyan; ^
Write-Host ('TOTAL LINES: {0:N0}' -f $totalLines) -ForegroundColor Cyan;"
pause