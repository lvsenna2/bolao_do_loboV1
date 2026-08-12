param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Ferramenta '$Name' nao encontrada. $InstallHint"
  }
}

Require-Command "git" "Instale o Git para Windows: https://git-scm.com/download/win"
Require-Command "node" "Instale o Node.js 22 LTS: https://nodejs.org/"

$NodeVersion = [version]((node --version).TrimStart("v").Split("-")[0])
if ($NodeVersion.Major -lt 20) {
  throw "Node.js 20 ou superior e necessario. Versao encontrada: $NodeVersion"
}

$PnpmCommand = Get-Command "pnpm" -ErrorAction SilentlyContinue
$CorepackCommand = Get-Command "corepack" -ErrorAction SilentlyContinue
if (-not $PnpmCommand -and -not $CorepackCommand) {
  throw "pnpm nao encontrado. Execute 'npm install --global pnpm@11.7.0' e tente novamente."
}

function Invoke-Pnpm {
  if ($PnpmCommand) {
    & pnpm @args
  } else {
    & corepack pnpm @args
  }
  if ($LASTEXITCODE -ne 0) {
    throw "O comando pnpm falhou com codigo $LASTEXITCODE."
  }
}

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "[setup] .env.local criado a partir de .env.example." -ForegroundColor Yellow
} else {
  Write-Host "[setup] .env.local existente foi preservado." -ForegroundColor Green
}

if (-not $SkipInstall) {
  Write-Host "[setup] Instalando dependencias..." -ForegroundColor Cyan
  Invoke-Pnpm install --frozen-lockfile
}

Write-Host "[setup] Gerando o Prisma Client..." -ForegroundColor Cyan
Invoke-Pnpm prisma:generate

Write-Host ""
Write-Host "Notebook preparado." -ForegroundColor Green
Write-Host "1. Preencha os segredos em .env.local."
Write-Host "2. Para banco local: docker compose up -d postgres; pnpm prisma:deploy"
Write-Host "3. Inicie com: pnpm dev"
Write-Host "Nenhuma migration foi aplicada automaticamente."
