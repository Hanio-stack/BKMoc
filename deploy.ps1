# 最新版を公開する: .\deploy.ps1  または  .\deploy.ps1 "変更メモ"
param([string]$Message = "update")

git add -A
git commit -m $Message
if (-not $?) { Write-Host "変更なし（コミットするものがありません）" -ForegroundColor Yellow }
git push
if ($?) {
  Write-Host ""
  Write-Host "公開しました。1分ほどで反映されます:" -ForegroundColor Green
  Write-Host "  https://hanio-stack.github.io/BKMoc/" -ForegroundColor Cyan
}
