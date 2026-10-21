param([ValidatePattern('^[a-z][a-z0-9-]{1,39}$')][string]$CommandName = 'yzzy')
# Run after npm.cmd install --global . ; changes only this user's PATH.
$ErrorActionPreference = 'Stop'
$yzzyPrefix = (& npm.cmd prefix --global).Trim()
if ($LASTEXITCODE -ne 0 -or -not [IO.Path]::IsPathRooted($yzzyPrefix)) { throw 'Cannot resolve npm global prefix.' }
$yzzyPrefix = [IO.Path]::GetFullPath($yzzyPrefix)
if (-not (Test-Path -LiteralPath (Join-Path $yzzyPrefix ($CommandName + '.cmd')) -PathType Leaf)) { throw 'Install the agent globally before configuring PATH.' }
$yzzyUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$yzzyEntries = @($yzzyUserPath -split ';' | Where-Object { $_.Trim() })
if (-not ($yzzyEntries | Where-Object { $_.Trim().TrimEnd('\') -ieq $yzzyPrefix.TrimEnd('\') })) {
  [Environment]::SetEnvironmentVariable('Path', (($yzzyEntries + $yzzyPrefix) -join ';'), 'User')
  Write-Output "Added npm global prefix to user PATH: $yzzyPrefix"
} else { Write-Output 'User PATH already contains npm global prefix.' }
# Notify Explorer so terminals opened from it receive the updated environment.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class YzzyEnvironmentNotice {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, UIntPtr wp, string lp, uint flags, uint timeout, out UIntPtr result);
}
'@
$yzzyNoticeResult = [UIntPtr]::Zero
[void][YzzyEnvironmentNotice]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 3000, [ref]$yzzyNoticeResult)
$env:Path = "$env:Path;$yzzyPrefix"
& (Join-Path $yzzyPrefix ($CommandName + '.cmd')) --version
if ($LASTEXITCODE -ne 0) { throw 'The installed command did not respond.' }
Write-Output "Open a new CMD and run $CommandName."
