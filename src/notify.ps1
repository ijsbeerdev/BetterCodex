[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateLength(1, 63)]
    [string]$Title,

    [Parameter(Mandatory)]
    [ValidateLength(1, 255)]
    [string]$Message
)

$notification = $null
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $notification = New-Object System.Windows.Forms.NotifyIcon
    $notification.Icon = [System.Drawing.SystemIcons]::Information
    $notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $notification.BalloonTipTitle = $Title
    $notification.BalloonTipText = $Message
    $notification.Visible = $true
    $notification.ShowBalloonTip(5000)
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 5500
} catch {
    # Notifications are helpful but must never make patching or launch fail.
} finally {
    if ($null -ne $notification) {
        $notification.Visible = $false
        $notification.Dispose()
    }
}
