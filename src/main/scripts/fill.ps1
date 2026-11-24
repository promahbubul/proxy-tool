param(
    [string]$Type = "HTTP",
    [string]$HostVal = "",
    [string]$PortVal = "",
    [string]$UserVal = "",
    [string]$PassVal = "",
    [string]$Browser = "geelark",
    [string]$StartField = "dropdown",
    [string]$Mode = "tab-sequence",
    [int]$DelayMs = 45,
    [switch]$SwitchToPreviousWindow
)

Add-Type -AssemblyName System.Windows.Forms

# Decode from environment variable if present (immune to CLI quoting, missing empty params, and $ variable expansion)
if ($env:SMARTFILL_PAYLOAD) {
    try {
        $pObj = $env:SMARTFILL_PAYLOAD | ConvertFrom-Json
        if ($null -ne $pObj.host) { $HostVal = [string]$pObj.host }
        if ($null -ne $pObj.port) { $PortVal = [string]$pObj.port }
        if ($null -ne $pObj.username) { $UserVal = [string]$pObj.username }
        if ($null -ne $pObj.password) { $PassVal = [string]$pObj.password }
        if ($null -ne $pObj.browser) { $Browser = [string]$pObj.browser }
        if ($null -ne $pObj.type) { $Type = [string]$pObj.type }
        if ($null -ne $pObj.startField) { $StartField = [string]$pObj.startField }
        if ($null -ne $pObj.mode) { $Mode = [string]$pObj.mode }
        if ($null -ne $pObj.delayMs) { $DelayMs = [int]$pObj.delayMs }
        if ($pObj.switchWindow) { $SwitchToPreviousWindow = $true }
    } catch {}
}

# Clean and trim values
$HostVal = if ($HostVal) { $HostVal.Trim() } else { "" }
$PortVal = if ($PortVal) { $PortVal.Trim() } else { "" }
$UserVal = if ($UserVal) { $UserVal.Trim() } else { "" }
$PassVal = if ($PassVal) { $PassVal.Trim() } else { "" }

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

# Reliably clears ALL existing data in the current input box (Ctrl+A -> Backspace) and types new value
function Clear-And-SetText([string]$val) {
    # 1. Select all existing text in the current input box
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 30

    # 2. Delete selected text completely
    [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
    Start-Sleep -Milliseconds 35

    # 3. Type new value if present
    if (-not [string]::IsNullOrEmpty($val)) {
        $escaped = Escape-ForSendKeys $val
        [System.Windows.Forms.SendKeys]::SendWait($escaped)
        Start-Sleep -Milliseconds 35
    }

    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

function Send-TabKey() {
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
    Start-Sleep -Milliseconds 50
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

function Send-ShiftTabKey() {
    [System.Windows.Forms.SendKeys]::SendWait("+{TAB}")
    Start-Sleep -Milliseconds 50
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

# Optional: switch focus back to target app if triggered from overlay click
if ($SwitchToPreviousWindow) {
    [System.Windows.Forms.SendKeys]::SendWait("%{TAB}")
    Start-Sleep -Milliseconds 180
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
# 2. GEELARK (TYPE FIRST) - Recommended! Starts in 'Type' dropdown
# Selects SOCKS5 / HTTP -> Tab into Host -> Port -> User -> Pass -> Check proxy!
# ---------------------------------------------------------------------
elseif ($b -eq "geelark" -or $b -eq "geelark-type") {
    # 1. Reset Type dropdown to top (HTTP)
    for ($i = 0; $i -lt 10; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
        Start-Sleep -Milliseconds 35
    }

    # 2. Select Protocol in GeeLark (HTTP: 0, HTTPS: 1, SOCKS5: 2)
    if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 55
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 55
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    elseif ($p -like "*HTTPS*") {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 55
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    else {
        # HTTP
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }

    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
    Start-Sleep -Milliseconds 220

    # Advance to Host box (Tab 1 lands on IP query channel, Tab 2 lands on Host box)
    Send-TabKey
    Send-TabKey

    # Step 1: Host box
    Clear-And-SetText $HostVal

    # Step 2: Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Username box (Tab 1 lands on Check proxy, Tab 2 lands on Username)
    Send-TabKey
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Password box (Tab 1 lands on Password)
    Send-TabKey
    Clear-And-SetText $PassVal

    # Step 5: Complete by triggering "Check proxy" button!
    # Shift+Tab 1 -> Username, Shift+Tab 2 -> Check proxy button
    Send-ShiftTabKey
    Send-ShiftTabKey
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
}

# ---------------------------------------------------------------------
# 3. GEELARK (HOST ONLY) - Cursor starts directly in 'Host' box
# Fills Host -> Port -> User -> Pass -> Check proxy!
# ---------------------------------------------------------------------
elseif ($b -eq "geelark-host") {
    # Step 1: In Host box (wipes old host, types new host)
    Clear-And-SetText $HostVal

    # Step 2: Tab into Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Tab into Username box (Tab 1 lands on Check proxy, Tab 2 lands on Username)
    Send-TabKey
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Tab into Password box
    Send-TabKey
    Clear-And-SetText $PassVal

    # Step 5: Complete by triggering "Check proxy" button!
    Send-ShiftTabKey
    Send-ShiftTabKey
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
}

# ---------------------------------------------------------------------
# 4. GOLOGIN (Handles dropdown first if selected, or direct Host box)
# ---------------------------------------------------------------------
elseif ($b -eq "gologin") {
    if ($StartField -eq "dropdown") {
        # Reset GoLogin dropdown to top option (HTTP Proxy)
        for ($i = 0; $i -lt 5; $i++) {
            [System.Windows.Forms.SendKeys]::SendWait("{UP}")
            Start-Sleep -Milliseconds 35
        }

        # Select protocol: HTTP (0) -> Socks 4 (1) -> Socks 5 (2)
        if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
            [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
            Start-Sleep -Milliseconds 55
            [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
            Start-Sleep -Milliseconds 55
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
        elseif ($p -like "*SOCKS4*") {
            [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
            Start-Sleep -Milliseconds 55
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
        else {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }

        Start-Sleep -Milliseconds 80
        [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
        Start-Sleep -Milliseconds 220

        # Move into Host box
        Send-TabKey
    }

    # Step 1: Host box
    Clear-And-SetText $HostVal

    # Step 2: Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Login box
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Password box
    Send-TabKey
    Clear-And-SetText $PassVal
}

# ---------------------------------------------------------------------
# 5. ADSPOWER (Host -> Tab -> Port -> Tab -> User -> Tab -> Pass)
# ---------------------------------------------------------------------
elseif ($b -eq "adspower") {
    # Step 1: Host box
    Clear-And-SetText $HostVal

    # Step 2: Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: User box
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Password box
    Send-TabKey
    Clear-And-SetText $PassVal
}

# ---------------------------------------------------------------------
# 6. UNIVERSAL / ANY BROWSER (Direct Host Box -> Tab Sequence)
# ---------------------------------------------------------------------
else {
    # Step 1: Host box
    Clear-And-SetText $HostVal

    # Step 2: Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Username box
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Password box
    Send-TabKey
    Clear-And-SetText $PassVal
}
