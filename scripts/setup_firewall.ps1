# MAD-OS ファイヤーウォール設定スクリプト
# このスクリップトは管理者権限で実行する必要があります。

$admin = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (!$admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "エラー: このスクリプトは管理者として実行する必要があります。" -ForegroundColor Red
    Write-Host "PowerShellを「管理者として実行」して再度お試しください。"
    return
}

Write-Host "MAD-OS 通信用ポートを開放しています..." -ForegroundColor Cyan

# Master Server (Socket.io)
New-NetFirewallRule -DisplayName "MAD-OS Master (TCP-3030)" -Direction Inbound -LocalPort 3030 -Protocol TCP -Action Allow -Force -ErrorAction SilentlyContinue

# Discovery (UDP)
New-NetFirewallRule -DisplayName "MAD-OS Discovery (UDP-3031)" -Direction Inbound -LocalPort 3031 -Protocol UDP -Action Allow -Force -ErrorAction SilentlyContinue

# Master Server (Socket.io) Outbound
New-NetFirewallRule -DisplayName "MAD-OS Master Out (TCP-3030)" -Direction Outbound -LocalPort 3030 -Protocol TCP -Action Allow -Force -ErrorAction SilentlyContinue

# Discovery (UDP) Outbound
New-NetFirewallRule -DisplayName "MAD-OS Discovery Out (UDP-3031)" -Direction Outbound -LocalPort 3031 -Protocol UDP -Action Allow -Force -ErrorAction SilentlyContinue

Write-Host "完了: MAD-OS の通信ルールが正常に登録されました。" -ForegroundColor Green
Write-Host "設定を確認するには、「セキュリティが強化されたWindowsファイアウォール」を開いてください。"
