# 매일 학습 보고서 자동 실행을 Windows Task Scheduler에 등록.
# 관리자 권한 PowerShell에서 한 번만 실행.

$ErrorActionPreference = "Stop"

$taskName = "TBSS-TelegramDailyLearn"
$pythonExe = (Get-Command python).Source
$scriptPath = Join-Path $PSScriptRoot "daily_learn.py"
$workingDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)  # repo root

# 매일 09:00 실행 (원하는 시간으로 수정 가능)
$trigger = New-ScheduledTaskTrigger -Daily -At "09:00"

$action = New-ScheduledTaskAction `
    -Execute $pythonExe `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $workingDir

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# 기존 태스크 있으면 제거
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "기존 태스크 제거: $taskName"
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description "TBSS 텔레그램 학습 코퍼스 일일 분석/보고서 자동 생성"

Write-Host ""
Write-Host "[OK] 등록 완료: $taskName (매일 09:00)"
Write-Host "  Python : $pythonExe"
Write-Host "  Script : $scriptPath"
Write-Host "  WorkDir: $workingDir"
Write-Host ""
Write-Host "수동 실행 테스트:"
Write-Host "  Start-ScheduledTask -TaskName $taskName"
Write-Host ""
Write-Host "주의: 텔레그램 MCP 서버(Claude Code)가 실행 중이면 fetch는 lock으로 실패하지만,"
Write-Host "      기존 corpus로 분석은 진행됩니다. fetch까지 받으려면 Claude Code가"
Write-Host "      꺼져있는 시간대로 trigger 시간을 조정하세요 (예: 03:00)."
