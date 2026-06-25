# MAD-OS ネットワーク診断スクリプト
# 通信トラブルの原因を特定します。

Write-Host "--- MAD-OS ネットワーク診断開始 ---" -ForegroundColor Cyan

# 1. IPアドレスの確認
Write-Host "`n[1] ローカルIPアドレスの確認" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object InterfaceAlias, IPAddress, AddressOrigin

# 2. ポートの使用状況確認 (3030, 3031)
Write-Host "`n[2] ポート使用状況の確認 (3030: Master, 3031: Discovery)" -ForegroundColor Yellow
$port3030 = Get-NetTCPConnection -LocalPort 3030 -ErrorAction SilentlyContinue
$port3031 = Get-NetUDPEndpoint -LocalPort 3031 -ErrorAction SilentlyContinue

if ($port3030) {
    Write-Host "PORT 3030 (TCP) は使用中です。" -ForegroundColor Green
} else {
    Write-Host "PORT 3030 (TCP) は待機していません。親機が起動しているか確認してください。" -ForegroundColor Red
}

if ($port3031) {
    Write-Host "PORT 3031 (UDP) は使用中です。" -ForegroundColor Green
} else {
    Write-Host "PORT 3031 (UDP) は待機していません。" -ForegroundColor Red
}

# 3. ファイヤーウォールルールの確認
Write-Host "`n[3] ファイヤーウォール設定の確認" -ForegroundColor Yellow
$rules = Get-NetFirewallRule -DisplayName "MAD-OS*" -ErrorAction SilentlyContinue
if ($rules) {
    Write-Host "MADOS用のルールが登録されています。" -ForegroundColor Green
    $rules | Select-Object DisplayName, Enabled, Direction, Action
} else {
    Write-Host "MADOS用のルールが見つかりません。setup_firewall.ps1 を実行してください。" -ForegroundColor Red
}

# 4. ネットワーク種別の確認
Write-Host "`n[4] ネットワークプロファイルの確認" -ForegroundColor Yellow
Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory
Write-Host "※ 'Public' の場合、ファイヤーウォールで通信が遮断される可能性が高くなります。" -ForegroundColor Gray

Write-Host "`n--- 診断終了 ---" -ForegroundColor Cyan
Write-Host "結果を開発チームに共有してください。"
