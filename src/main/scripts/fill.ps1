param(
    [string]$Type = "HTTP",
    [string]$HostVal = "",
    [string]$PortVal = "",
    [string]$UserVal = "",
    [string]$PassVal = "",
    [string]$Browser = "smart", # 'smart', 'geelark', 'geelark-host', 'gologin', 'adspower', 'dolphin', 'universal'
    [string]$StartField = "dropdown",
    [string]$Mode = "tab-sequence",
    [int]$DelayMs = 45,
    [switch]$SwitchToPreviousWindow
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

# 1. Decode from environment variable if present (bulletproof against CLI quoting & $ variable expansion)
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

# =====================================================================
# SMART UI AUTOMATION ENGINE (Finds fields anywhere on the page)
# =====================================================================
function Try-SmartUIADetectionAndFill {
    try {
        $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
        if ($null -eq $focused) { return $false }

        # Traverse up to find the active top-level target window (GeeLark, GoLogin, AdsPower, etc.)
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $cur = $focused
        while ($null -ne $cur -and $cur.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window) {
            $parent = $walker.GetParent($cur)
            if ($null -eq $parent) { break }
            $cur = $parent
        }
        $targetWin = $cur
        if ($null -eq $targetWin) { return $false }

        # Query all Edit controls (input boxes) inside target window
        $condEdit = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
        )
        $edits = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condEdit)
        if ($edits.Count -lt 2) { return $false }

        $foundHost = $null
        $foundPort = $null
        $foundUser = $null
        $foundPass = $null

        foreach ($e in $edits) {
            $name = ($e.Current.Name + " " + $e.Current.HelpText + " " + $e.Current.AutomationId).ToLower()
            $isPass = $e.Current.IsPassword

            # 1. Password input: HTML <input type="password"> always sets IsPassword=true in UIA!
            if ($isPass -or ($name -match "pass|secret" -and $name -notmatch "bypass")) {
                if ($null -eq $foundPass) { $foundPass = $e; continue }
            }

            # 2. Username input: matching user/login/account
            if ($name -match "user|login|account|uname" -and $name -notmatch "pass") {
                if ($null -eq $foundUser) { $foundUser = $e; continue }
            }

            # 3. Port input: matching port or ':'
            if ($name -match "port|\b:\b" -and $name -notmatch "original") {
                if ($null -eq $foundPort) { $foundPort = $e; continue }
            }

            # 4. Host input: matching host/ip/server/address (excluding "original ip")
            if ($name -match "host|server|proxy ip|\bip\b|address" -and $name -notmatch "original ip") {
                if ($null -eq $foundHost) { $foundHost = $e; continue }
            }
        }

        # If name matching missed Port but found Host, check geometry (Port is directly to the right of Host)
        if ($null -ne $foundHost -and $null -eq $foundPort) {
            $hRect = $foundHost.Current.BoundingRectangle
            foreach ($e in $edits) {
                if ($e -ne $foundHost -and $e -ne $foundPass -and $e -ne $foundUser) {
                    $eRect = $e.Current.BoundingRectangle
                    # Same Y-level (within 15px) and to the right of Host
                    if ([Math]::Abs($eRect.Y - $hRect.Y) -lt 15 -and $eRect.X -gt $hRect.X) {
                        $foundPort = $e
                        break
                    }
                }
            }
        }

        # We must identify at least Host and Port to be confident in Smart UIA
        if ($null -eq $foundHost -or $null -eq $foundPort) {
            return $false
        }

        Write-Host "SmartFill: UI Automation matched fields successfully!"

        # Query ComboBox for Proxy Type
        $foundCombo = $null
        try {
            $condCombo = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::ComboBox
            )
            $combos = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condCombo)
            foreach ($cb in $combos) {
                $cbName = ($cb.Current.Name + " " + $cb.Current.HelpText + " " + $cb.Current.AutomationId).ToLower()
                if ($cbName -match "type|proto|decodo|http|socks") {
                    $foundCombo = $cb
                    break
                }
            }
        } catch {}

        # 1. Fill Proxy Type ComboBox if found
        if ($null -ne $foundCombo) {
            try {
                $foundCombo.SetFocus()
                Start-Sleep -Milliseconds 40
                $p = $Type.ToUpper().Trim()

                for ($i = 0; $i -lt 10; $i++) {
                    [System.Windows.Forms.SendKeys]::SendWait("{UP}")
                    Start-Sleep -Milliseconds 25
                }
                if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
                    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
                    Start-Sleep -Milliseconds 40
                    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
                    Start-Sleep -Milliseconds 40
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                }
                elseif ($p -like "*HTTPS*") {
                    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
                    Start-Sleep -Milliseconds 40
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                }
                else {
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                }
                Start-Sleep -Milliseconds 50
                [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
                Start-Sleep -Milliseconds 120
            } catch {}
        }

        # 2. Fill Host directly
        $foundHost.SetFocus()
        Start-Sleep -Milliseconds 30
        Clear-And-SetText $HostVal

        # 3. Fill Port directly
        $foundPort.SetFocus()
        Start-Sleep -Milliseconds 30
        Clear-And-SetText $PortVal

        # 4. Fill Username directly if identified
        if ($null -ne $foundUser) {
            $foundUser.SetFocus()
            Start-Sleep -Milliseconds 30
            Clear-And-SetText $UserVal
        }

        # 5. Fill Password directly if identified
        if ($null -ne $foundPass) {
            $foundPass.SetFocus()
            Start-Sleep -Milliseconds 30
            Clear-And-SetText $PassVal
        }

        # 6. Check Proxy Button: click to complete verification if present!
        try {
            $condBtn = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::Button
            )
            $btns = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condBtn)
            foreach ($btn in $btns) {
                $btnName = ($btn.Current.Name + " " + $btn.Current.HelpText + " " + $btn.Current.AutomationId).ToLower()
                if ($btnName -match "check|test proxy") {
                    $invokePattern = $null
                    try {
                        $invokePattern = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) -as [System.Windows.Automation.InvokePattern]
                    } catch {}
                    if ($null -ne $invokePattern) {
                        $invokePattern.Invoke()
                    } else {
                        $btn.SetFocus()
                        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    }
                    break
                }
            }
        } catch {}

        return $true
    }
    catch {
        return $false
    }
}

$b = $Browser.ToLower().Trim()
$p = $Type.ToUpper().Trim()

# ---------------------------------------------------------------------
# ATTEMPT SMART UI AUTOMATION DETECTION FIRST
# ---------------------------------------------------------------------
# If 'smart' mode or browser preset is active, try smart field detection first
if ($b -eq "smart" -or $b -like "*geelark*" -or $b -eq "gologin" -or $b -eq "adspower") {
    $smartSuccess = Try-SmartUIADetectionAndFill
    if ($smartSuccess) {
        exit 0
    }
}

# ---------------------------------------------------------------------
# FALLBACK 1. DOLPHIN{ANTY} / OCTO BROWSER (Single-Line Quick Import Box)
# ---------------------------------------------------------------------
if ($b -eq "dolphin" -or $b -like "*dolphin*" -or $b -eq "octo" -or $Mode -eq "single-line" -or $StartField -eq "paste-url") {
    $full = "$HostVal`:$PortVal"
    if ($UserVal) {
        $full += "`:$UserVal`:$PassVal"
    }
    Clear-And-SetText $full
}

# ---------------------------------------------------------------------
# FALLBACK 2. GEELARK (TYPE FIRST) - Starts in 'Type' dropdown
# ---------------------------------------------------------------------
elseif ($b -eq "geelark" -or $b -eq "geelark-type" -or $b -eq "smart") {
    for ($i = 0; $i -lt 10; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
        Start-Sleep -Milliseconds 35
    }

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
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }

    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
    Start-Sleep -Milliseconds 220

    # Advance to Host box (Tab 1 -> IP query channel, Tab 2 -> Host box)
    Send-TabKey
    Send-TabKey

    # Step 1: Host box
    Clear-And-SetText $HostVal

    # Step 2: Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Username box (Tab 1 -> Check proxy, Tab 2 -> Username)
    Send-TabKey
    Send-TabKey
    Clear-And-SetText $UserVal

    # Step 4: Password box
    Send-TabKey
    Clear-And-SetText $PassVal

    # Step 5: Complete by triggering "Check proxy" button!
    Send-ShiftTabKey
    Send-ShiftTabKey
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
}

# ---------------------------------------------------------------------
# FALLBACK 3. GEELARK (HOST ONLY) - Cursor starts directly in 'Host' box
# ---------------------------------------------------------------------
elseif ($b -eq "geelark-host") {
    # Step 1: In Host box (wipes old host, types new host)
    Clear-And-SetText $HostVal

    # Step 2: Tab into Port box
    Send-TabKey
    Clear-And-SetText $PortVal

    # Step 3: Tab into Username box (Tab 1 -> Check proxy, Tab 2 -> Username)
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
# FALLBACK 4. GOLOGIN (Handles dropdown first if selected, or direct Host box)
# ---------------------------------------------------------------------
elseif ($b -eq "gologin") {
    if ($StartField -eq "dropdown") {
        for ($i = 0; $i -lt 5; $i++) {
            [System.Windows.Forms.SendKeys]::SendWait("{UP}")
            Start-Sleep -Milliseconds 35
        }

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
# FALLBACK 5. ADSPOWER (Host -> Tab -> Port -> Tab -> User -> Tab -> Pass)
# ---------------------------------------------------------------------
elseif ($b -eq "adspower") {
    Clear-And-SetText $HostVal
    Send-TabKey
    Clear-And-SetText $PortVal
    Send-TabKey
    Clear-And-SetText $UserVal
    Send-TabKey
    Clear-And-SetText $PassVal
}

# ---------------------------------------------------------------------
# FALLBACK 6. UNIVERSAL / ANY BROWSER (Direct Host Box -> Tab Sequence)
# ---------------------------------------------------------------------
else {
    Clear-And-SetText $HostVal
    Send-TabKey
    Clear-And-SetText $PortVal
    Send-TabKey
    Clear-And-SetText $UserVal
    Send-TabKey
    Clear-And-SetText $PassVal
}
