[CmdletBinding()]
param(
  [switch]$UseFreeLlm,
  [switch]$NoTunnel,
  [int]$AppPort = 4173,
  [int]$ApiPort = 8000
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$deployDir = Join-Path $root "output\deploy"
$runtimeFile = Join-Path $deployDir "runtime.json"
$urlFile = Join-Path $deployDir "demo-url.txt"
$python = Join-Path $root ".venv\Scripts\python.exe"

New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Set-Location $root

function Test-PortInUse {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-Http {
  param(
    [string]$Url,
    [int]$Seconds = 60
  )
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }
  throw "服务未在 ${Seconds} 秒内就绪: $Url"
}

function Wait-NgrokHttpsUrl {
  param([int]$Seconds = 35)
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
      $httpsTunnel = $tunnels.tunnels |
        Where-Object { $_.public_url -like "https://*" } |
        Select-Object -First 1
      if ($httpsTunnel) {
        return $httpsTunnel.public_url
      }
    } catch {
      # Ngrok 控制台可能仍在启动。
    }
    Start-Sleep -Milliseconds 700
  }
  throw "Ngrok 已启动，但未获得 HTTPS 公网地址。"
}

function Save-Runtime {
  param([string]$PublicUrl)
  $runtime = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    appPort = $AppPort
    apiPort = $ApiPort
    publicUrl = $PublicUrl
    apiProcessId = $apiProcessId
    viteProcessId = $viteProcessId
    ngrokProcessId = $ngrokProcessId
    apiOwnerProcessId = (
      Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    ).OwningProcess
    viteOwnerProcessId = (
      Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    ).OwningProcess
    ngrokOwnerProcessId = (
      Get-NetTCPConnection -LocalPort 4040 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    ).OwningProcess
    apiReused = $apiReused
    viteReused = $viteReused
    freeLlm = [bool]$UseFreeLlm
  }
  $runtime | ConvertTo-Json |
    Set-Content -LiteralPath $runtimeFile -Encoding utf8NoBOM
  Set-Content -LiteralPath $urlFile -Value $PublicUrl -Encoding utf8NoBOM
}

if (-not (Test-Path -LiteralPath $python)) {
  throw "未找到虚拟环境: $python。请先执行 python -m venv .venv 并安装依赖。"
}
if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Host "未找到 node_modules，正在安装前端依赖..."
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install 失败。"
  }
}

$apiProcessId = $null
$viteProcessId = $null
$ngrokProcessId = $null
$apiReused = $false
$viteReused = $false

if (Test-PortInUse -Port $ApiPort) {
  $apiReused = $true
  Write-Host "复用已有 FastAPI: http://127.0.0.1:$ApiPort"
} else {
  $env:LLM_PROVIDER = if ($UseFreeLlm) { "pollinations" } else { "local" }
  if ($UseFreeLlm -and -not $env:LLM_MODEL) {
    $env:LLM_MODEL = "openai"
  }
  $apiOut = Join-Path $deployDir "api.log"
  $apiErr = Join-Path $deployDir "api.err.log"
  $apiProcess = Start-Process `
    -FilePath $python `
    -ArgumentList @("-m", "uvicorn", "server.app:app", "--host", "127.0.0.1", "--port", "$ApiPort") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $apiOut `
    -RedirectStandardError $apiErr `
    -PassThru
  $apiProcessId = $apiProcess.Id
  Write-Host "已启动 FastAPI，PID=$apiProcessId"
}

Wait-Http -Url "http://127.0.0.1:$ApiPort/api/health"

if (Test-PortInUse -Port $AppPort) {
  $viteReused = $true
  Write-Host "复用已有 Vite: http://127.0.0.1:$AppPort"
} else {
  $viteOut = Join-Path $deployDir "vite.log"
  $viteErr = Join-Path $deployDir "vite.err.log"
  $viteProcess = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$AppPort") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $viteOut `
    -RedirectStandardError $viteErr `
    -PassThru
  $viteProcessId = $viteProcess.Id
  Write-Host "已启动 Vite，PID=$viteProcessId"
}

Wait-Http -Url "http://127.0.0.1:$AppPort"

$publicUrl = "http://127.0.0.1:$AppPort"
Save-Runtime -PublicUrl $publicUrl
if (-not $NoTunnel) {
  if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    throw "未找到 ngrok。请先安装 Ngrok 3.x 并配置 authtoken。"
  }
  $ngrokOut = Join-Path $deployDir "ngrok.log"
  $ngrokErr = Join-Path $deployDir "ngrok.err.log"
  $ngrokProcess = Start-Process `
    -FilePath "ngrok" `
    -ArgumentList @("http", "$AppPort", "--log=stdout", "--log-format=json") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ngrokOut `
    -RedirectStandardError $ngrokErr `
    -PassThru
  $ngrokProcessId = $ngrokProcess.Id
  Wait-Http -Url "http://127.0.0.1:4040/api/tunnels" -Seconds 30
  $publicUrl = Wait-NgrokHttpsUrl
  Write-Host "已启动 Ngrok，PID=$ngrokProcessId"
}

Save-Runtime -PublicUrl $publicUrl

Write-Host ""
Write-Host "本地地址: http://127.0.0.1:$AppPort"
Write-Host "在线演示: $publicUrl"
Write-Host "运行记录: $runtimeFile"
