param(
    [string]$Type = "HTTP",
    [string]$HostVal = "",
    [string]$PortVal = "",
    [string]$UserVal = "",
    [string]$PassVal = "",
    [string]$StartField = "dropdown", # 'dropdown' (cursor in dropdown), 'host-only' (cursor in IP box), 'paste-url'
    [string]$Mode = "tab-sequence", # 'tab-sequence', 'single-line', 'cred-only'
    [int]$DelayMs = 50,
    [switch]$SwitchToPreviousWindow
)

Add-Type -AssemblyName System.Windows.Forms

function Escape-ForSendKeys([string]$inputStr) {
    if ([string]::IsNullOrEmpty($inputStr)) { return "" }
    $out = ""
    $chars = $inputStr.ToCharArray()
    foreach ($ch in $chars) {
        $c = [string]$ch
        if ($c -eq '+' -or $c -eq '^' -or $c -eq '%' -or $c -eq '~' -or $c -eq '(' -or $c -eq ')' -or $c -eq '{' -or $c -eq '}' -or $c -eq '[' -or $c -eq ']') {
            $out += "{$c}"
        } else {
            $out += $c
        }
    }
    return $out
}

# Safely clears any existing / default text inside current input box WITHOUT selecting whole page
function Clear-And-SetText([string]$val) {
    [System.Windows.Forms.SendKeys]::SendWait("{END}+{HOME}{BACKSPACE}")
    Start-Sleep -Milliseconds 30

    if (-not [string]::IsNullOrEmpty($val)) {
        $escaped = Escape-ForSendKeys $val
        [System.Windows.Forms.SendKeys]::SendWait($escaped)
    }
    
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

function Send-TabKey() {
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

# Selects protocol in dropdown, commits with ENTER, closes with ESCAPE, and moves to IP field
function Select-And-CommitDropdown([string]$protoType) {
    $p = $protoType.ToUpper().Trim()
    
    # 1. Reset to top option (HTTP Proxy) with discrete key events
    for ($i = 0; $i -lt 5; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
        Start-Sleep -Milliseconds 35
    }

    # 2. Navigate to target protocol in GoLogin / GeeLark
    if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
        # GoLogin: HTTP (0) -> Socks 4 (1) -> Socks 5 (2)
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    elseif ($p -like "*SOCKS4*") {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    elseif ($p -like "*SHADOW*") {
        for ($i = 0; $i -lt 3; $i++) {
            [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
            Start-Sleep -Milliseconds 60
        }
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    else {
        # HTTP / HTTPS Proxy (Option 0)
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    
    Start-Sleep -Milliseconds 80

    # 3. CRITICAL: Ensure popup popover is closed so focus is NEVER trapped inside the dropdown!
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")

    # 4. Wait for GoLogin to re-render DOM fields (IP, Port, Login, Password)
    Start-Sleep -Milliseconds 220
}

# Optional: switch focus back if triggered from overlay click
if ($SwitchToPreviousWindow) {
    [System.Windows.Forms.SendKeys]::SendWait("%{TAB}")
    Start-Sleep -Milliseconds 150
}

if ($Mode -eq "single-line" -or $StartField -eq "paste-url") {
    $full = "$HostVal`:$PortVal"
    if ($UserVal) {
        $full += "`:$UserVal`:$PassVal"
    }
    Clear-And-SetText $full
}
elseif ($Mode -eq "cred-only") {
    if ($UserVal) { Clear-And-SetText $UserVal }
    Send-TabKey
    if ($PassVal) { Clear-And-SetText $PassVal }
}
else {
    # If starting from Proxy Type dropdown (recommended when changing SOCKS5 vs HTTP)
    if ($StartField -eq "dropdown") {
        Select-And-CommitDropdown $Type
        # Tab moves from closed dropdown into IP Address box
        Send-TabKey
    }

    # Now in IP Address / Host box
    Clear-And-SetText $HostVal
    Send-TabKey

    # Port box
    Clear-And-SetText $PortVal

    # Login and Password boxes
    if ($UserVal -or $PassVal) {
        Send-TabKey
        Clear-And-SetText $UserVal
        Send-TabKey
        Clear-And-SetText $PassVal
    }
}
