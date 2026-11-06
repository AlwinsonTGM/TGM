Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class SyntheticWindowNative { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'
$window = New-Object System.Windows.Forms.Form
$window.Text = 'Agent Desktop Synthetic Proof 8D4C'
$window.Size = New-Object System.Drawing.Size(460, 220)
$window.StartPosition = 'CenterScreen'
$label = New-Object System.Windows.Forms.Label
$label.Text = 'Status: waiting'
$label.Location = New-Object System.Drawing.Point(30, 25)
$label.AutoSize = $true
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Mark complete'
$button.Location = New-Object System.Drawing.Point(30, 70)
$button.Size = New-Object System.Drawing.Size(160, 40)
$button.Add_Click({ $label.Text = 'Status: complete' })
$window.Controls.Add($label)
$window.Controls.Add($button)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 300
$timer.Add_Tick({ [void] [SyntheticWindowNative]::ShowWindow($window.Handle, 5); $timer.Stop() })
$timer.Start()
[void] $window.ShowDialog()
