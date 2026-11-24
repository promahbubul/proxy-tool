param(
    [string]$Type = "HTTP",
    [string]$HostVal = "",
    [string]$PortVal = "",
    [string]$UserVal = "",
    [string]$PassVal = "",
    [string]$Browser = "gologin", # 'gologin', 'geelark', 'adspower', 'dolphin', 'universal'
    [string]$StartField = "dropdown",
    [string]$Mode = "tab-sequence",
    [int]$DelayMs = 45,
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

# Optional: switch focus back if triggered from overlay click
if ($SwitchToPreviousWindow) {
    [System.Windows.Forms.SendKeys]::SendWait("%{TAB}")
    Start-Sleep -Milliseconds 150
}

$b = $Browser.ToLower().Trim()
$p = $Type.ToUpper().Trim()

# ---------------------------------------------------------------------
# 1. DOLPHIN{ANTY} / OCTO BROWSER (Single-Line Quick Import Box)
# ---------------------------------------------------------------------
if ($b -eq "dolphin" -or $b -like "*dolphin*" -or $b -eq "octo" -or $Mode -eq "single-line" -or $StartField -eq "paste-url") {
    $full = "$HostVal`:$PortVal"
    if ($UserVal) {
        $full += "`:$UserVal`:$PassVal"
    }
    Clear-And-SetText $full
}

# ---------------------------------------------------------------------
# 2. GOLOGIN (Dropdown -> SOCKS5 / HTTP -> ESC -> TAB -> Host -> Port -> User -> Pass)
# ---------------------------------------------------------------------
elseif ($b -eq "gologin") {
    # 1. Reset GoLogin dropdown to top option (HTTP Proxy)
    for ($i = 0; $i -lt 5; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
        Start-Sleep -Milliseconds 35
    }

    # 2. Select protocol: HTTP (0) -> Socks 4 (1) -> Socks 5 (2)
    if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
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
    else {
        # HTTP Proxy (Option 0)
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }

    Start-Sleep -Milliseconds 80
    # Close GoLogin popover so keyboard focus advances to IP Address
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
    Start-Sleep -Milliseconds 220

    # Advance to IP Address box
    Send-TabKey
    Clear-And-SetText $HostVal

    # Advance to Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Advance to Login and Password boxes
    if ($UserVal -or $PassVal) {
        Send-TabKey
        Clear-And-SetText $UserVal
        Send-TabKey
        Clear-And-SetText $PassVal
    }
}

# ---------------------------------------------------------------------
# 3. GEELARK (Dropdown -> HTTP / HTTPS / SOCKS5 -> ESC -> TAB -> Host -> Port -> User -> Pass)
# ---------------------------------------------------------------------
elseif ($b -eq "geelark") {
    # GeeLark dropdown options: HTTP (0), HTTPS (1), SOCKS5 (2)
    for ($i = 0; $i -lt 5; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
        Start-Sleep -Milliseconds 35
    }

    if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    elseif ($p -like "*HTTPS*") {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 60
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    else {
        # HTTP
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }

    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
    Start-Sleep -Milliseconds 180

    # Advance to Server IP / Host box
    Send-TabKey
    Clear-And-SetText $HostVal

    # Advance to Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Advance to User & Password
    if ($UserVal -or $PassVal) {
        Send-TabKey
        Clear-And-SetText $UserVal
        Send-TabKey
        Clear-And-SetText $PassVal
    }
}

# ---------------------------------------------------------------------
# 4. ADSPOWER (Safe Host Field -> Tab -> Port -> Tab -> User -> Tab -> Pass)
# ---------------------------------------------------------------------
elseif ($b -eq "adspower") {
    Clear-And-SetText $HostVal
    Send-TabKey
    Clear-And-SetText $PortVal
    if ($UserVal -or $PassVal) {
        Send-TabKey
        Clear-And-SetText $UserVal
        Send-TabKey
        Clear-And-SetText $PassVal
    }
}

# ---------------------------------------------------------------------
# 5. UNIVERSAL / ANY BROWSER (Direct IP Box: Host -> Tab -> Port -> Tab -> User -> Tab -> Pass)
# ---------------------------------------------------------------------
else {
    Clear-And-SetText $HostVal
    Send-TabKey
    Clear-And-SetText $PortVal
    if ($UserVal -or $PassVal) {
        Send-TabKey
        Clear-And-SetText $UserVal
        Send-TabKey
        Clear-And-SetText $PassVal
    }
}
