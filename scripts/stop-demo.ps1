$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeFile = Join-Path $root "output\deploy\runtime.json"

if (-not (Test-Path -LiteralPath $runtimeFile)) {
  Write-Host "未找到运行记录，无需停止。"
  exit 0
}

$runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
$processIds = @()
if (-not $runtime.apiReused) {
  $processIds += $runtime.apiProcessId
  $processIds += $runtime.apiOwnerProcessId
}
if (-not $runtime.viteReused) {
  $processIds += $runtime.viteProcessId
  $processIds += $runtime.viteOwnerProcessId
}
$processIds += $runtime.ngrokProcessId
$processIds += $runtime.ngrokOwnerProcessId
$processIds = $processIds |
  Where-Object { $_ -and "$_" -ne "0" } |
  ForEach-Object { [int]$_ } |
  Select-Object -Unique

function Get-ProcessTreeIds {
  param([int]$ParentId)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" -ErrorAction SilentlyContinue
  $ids = @()
  foreach ($child in $children) {
    $ids += Get-ProcessTreeIds -ParentId $child.ProcessId
    $ids += $child.ProcessId
  }
  return $ids
}

$expandedIds = @()
foreach ($processId in $processIds) {
  $expandedIds += Get-ProcessTreeIds -ParentId $processId
  $expandedIds += $processId
}
$expandedIds = $expandedIds | Select-Object -Unique

foreach ($processId in $expandedIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force
    Write-Host "已停止进程 PID=$processId"
  }
}

Write-Host "演示进程已停止。"
