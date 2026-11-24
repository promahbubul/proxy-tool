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

# Reliably clears ALL existing data in the current input box (Ctrl+A -> Backspace -> Delete)
function Clear-Field() {
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 25
    [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
    Start-Sleep -Milliseconds 25
    [System.Windows.Forms.SendKeys]::SendWait("{DELETE}")
    Start-Sleep -Milliseconds 25
}

# Reliably clears ALL existing data in the current input box and types new value
function Clear-And-SetText([string]$val) {
    # 1. Select all and delete completely
    Clear-Field

    # 2. Type new value if present
    if (-not [string]::IsNullOrEmpty($val)) {
        $escaped = Escape-ForSendKeys $val
        [System.Windows.Forms.SendKeys]::SendWait($escaped)
        Start-Sleep -Milliseconds 35
    }

    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

# Reliably selects SOCKS5 / HTTPS / HTTP in select dropdown
function Select-ProxyTypeInDropdown([string]$proto) {
    $p = if ($proto) { $proto.ToUpper().Trim() } else { "SOCKS5" }

    # 1. Open dropdown (Alt+Down opens Windows comboboxes, Enter / Space opens web selects)
    [System.Windows.Forms.SendKeys]::SendWait("%{DOWN}")
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 80

    # 2. Reset selection to the top item (HTTP)
    [System.Windows.Forms.SendKeys]::SendWait("{HOME}")
    Start-Sleep -Milliseconds 40

    # GeeLark select options order:
    # 1. HTTP
    # 2. HTTPS
    # 3. SOCKS5
    if ($p -like "*SOCKS5*" -or $p -eq "SOCKS" -or $p -like "*SOCKS*") {
        # SOCKS5 is 3rd item: 2 down from Home
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 35
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 35
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    elseif ($p -like "*HTTPS*") {
        # HTTPS is 2nd item: 1 down from Home
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
        Start-Sleep -Milliseconds 35
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    else {
        # HTTP is 1st item: already at Home
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }

    Start-Sleep -Milliseconds 40
    [System.Windows.Forms.SendKeys]::SendWait("{ESCAPE}")
    Start-Sleep -Milliseconds 70
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

# If GeeLark is selected, ensure GeeLark window is activated into foreground
if ($Browser -match "geelark") {
    try {
        $gl = Get-Process -Name "*geelark*" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
        if ($null -ne $gl) {
            $wshell = New-Object -ComObject WScript.Shell
            $wshell.AppActivate($gl.Id)
            Start-Sleep -Milliseconds 120
        }
    } catch {}
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

        # 1. Locate the Host box first (strictly exclude Cookie, Remarks, User Agent, Tag, OS, etc.)
        foreach ($e in $edits) {
            $name = ($e.Current.Name + " " + $e.Current.HelpText + " " + $e.Current.AutomationId).ToLower()
            if ($name -match "cookie|remark|agent|tag|bypass|\bos\b") { continue }
            if ($name -match "host|server|proxy ip|proxy address") {
                $foundHost = $e
                break
            }
        }

        # If not found by name, detect the side-by-side pair: Host & Port are horizontally adjacent!
        if ($null -eq $foundHost) {
            foreach ($e1 in $edits) {
                $r1 = $e1.Current.BoundingRectangle
                $n1 = ($e1.Current.Name + " " + $e1.Current.HelpText).ToLower()
                if ($n1 -match "cookie|remark|agent|tag") { continue }
                if ($r1.Width -gt 60 -and $r1.Height -gt 15) {
                    foreach ($e2 in $edits) {
                        if ($e1 -ne $e2) {
                            $r2 = $e2.Current.BoundingRectangle
                            # Host and Port are adjacent on the same line (Y diff < 12, e2 to right of e1, distance < 350)
                            if ([Math]::Abs($r1.Y - $r2.Y) -lt 12 -and $r2.X -gt $r1.X -and ($r2.X - $r1.X) -lt 350) {
                                $foundHost = $e1
                                $foundPort = $e2
                                break
                            }
                        }
                    }
                    if ($null -ne $foundHost) { break }
                }
            }
        }

        if ($null -eq $foundHost) {
            return $false
        }

        $hRect = $foundHost.Current.BoundingRectangle
        $hY = $hRect.Y
        $hX = $hRect.X

        # 2. Locate Port: MUST BE ON THE EXACT SAME HORIZONTAL LINE AS HOST, TO THE RIGHT!
        # This completely guarantees Cookie (at hY - 340) can NEVER be Port!
        if ($null -eq $foundPort) {
            foreach ($e in $edits) {
                if ($e -ne $foundHost) {
                    $r = $e.Current.BoundingRectangle
                    if ([Math]::Abs($r.Y - $hY) -lt 12 -and $r.X -gt $hX -and $r.X -lt ($hX + 350)) {
                        $foundPort = $e
                        break
                    }
                }
            }
        }

        # 3. Locate Username & Password: MUST BE STRICTLY BELOW HOST (Y between hY + 15 and hY + 150)
        # This completely guarantees Cookie, User Agent, and Remarks can NEVER be matched!
        $foundUser = $null
        $foundPass = $null

        foreach ($e in $edits) {
            $r = $e.Current.BoundingRectangle
            if ($r.Y -gt ($hY + 15) -and $r.Y -lt ($hY + 150)) {
                $n = ($e.Current.Name + " " + $e.Current.HelpText + " " + $e.Current.AutomationId).ToLower()
                if ($e.Current.IsPassword -or $n -match "pass|secret" -or $r.X -gt ($hX + 160)) {
                    if ($null -eq $foundPass) { $foundPass = $e }
                } else {
                    if ($null -eq $foundUser) { $foundUser = $e }
                }
            }
        }

        # 4. Locate Type Dropdown: MUST BE IN THE ROW DIRECTLY ABOVE HOST (Y between hY - 110 and hY - 10)
        # This completely guarantees Cookie (at hY - 340) and Remarks (at hY - 220) can NEVER be matched!
        $foundTypeElement = $null
        try {
            $condType = New-Object System.Windows.Automation.OrCondition(
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ComboBox)),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Custom)),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))
            )
            $candidates = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condType)
            foreach ($c in $candidates) {
                $r = $c.Current.BoundingRectangle
                if ($r.Y -ge ($hY - 110) -and $r.Y -le ($hY - 10) -and $r.Height -gt 15) {
                    $n = ($c.Current.Name + " " + $c.Current.HelpText + " " + $c.Current.AutomationId).ToLower()
                    if ($n -match "cookie|remark|agent|tag") { continue }
                    if ($n -match "socks|http|https|type|custom" -or $c.Current.ControlType -eq [System.Windows.Automation.ControlType]::ComboBox) {
                        $foundTypeElement = $c
                        break
                    }
                }
            }
        } catch {}

        Write-Host "SmartFill: UI Automation isolated Proxy Settings successfully! Host Y=$hY"

        # =============================================================
        # STEP 1: CLEAN / REMOVE ALL FIELDS FIRST (Empty all existing data)
        # =============================================================
        if ($null -ne $foundHost) {
            $foundHost.SetFocus()
            Start-Sleep -Milliseconds 25
            Clear-Field
        }
        if ($null -ne $foundPort) {
            $foundPort.SetFocus()
            Start-Sleep -Milliseconds 25
            Clear-Field
        }
        if ($null -ne $foundUser) {
            $foundUser.SetFocus()
            Start-Sleep -Milliseconds 25
            Clear-Field
        }
        if ($null -ne $foundPass) {
            $foundPass.SetFocus()
            Start-Sleep -Milliseconds 25
            Clear-Field
        }

        # =============================================================
        # STEP 2: FILL FIELDS ONE BY ONE (Type -> Host -> Port -> User -> Pass)
        # =============================================================
        # 1. Fill Proxy Type from select dropdown
        if ($null -ne $foundTypeElement) {
            try {
                $foundTypeElement.SetFocus()
                Start-Sleep -Milliseconds 40
                Select-ProxyTypeInDropdown $Type
            } catch {}
        }
        elseif ($null -ne $foundHost -and $Browser -match "geelark") {
            # In GeeLark, Type dropdown is 1 Shift+Tab before Host
            $foundHost.SetFocus()
            Start-Sleep -Milliseconds 35
            Send-ShiftTabKey
            Start-Sleep -Milliseconds 40
            Select-ProxyTypeInDropdown $Type
        }

        # 2. Fill Host directly
        if ($null -ne $foundHost) {
            $foundHost.SetFocus()
            Start-Sleep -Milliseconds 30
            Clear-And-SetText $HostVal
        }

        # 3. Fill Port directly
        if ($null -ne $foundPort) {
            $foundPort.SetFocus()
            Start-Sleep -Milliseconds 30
            Clear-And-SetText $PortVal
        }

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

        # ONLY fill Type, Host, Port, Username, Password. No extra buttons clicked!
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
# FALLBACK 2. GEELARK - STAYS STRICTLY INSIDE PROXY SETTINGS
# ---------------------------------------------------------------------
elseif ($b -eq "geelark" -or $b -like "*geelark*") {
    # GeeLark keyboard fallback: Starts in Host box (or navigates to Host)
    # =================================================================
    # STEP 1: CLEAN / REMOVE ALL FIELDS FIRST
    # =================================================================
    # Clean Host
    Clear-Field

    # Tab to Port and clean
    Send-TabKey
    Clear-Field

    # Tab x 2 to Username (skips Check proxy button) and clean
    Send-TabKey
    Send-TabKey
    Clear-Field

    # Tab to Password and clean
    Send-TabKey
    Clear-Field

    # =================================================================
    # STEP 2: RETURN TO TYPE DROPDOWN (STRICTLY INSIDE PROXY SETTINGS)
    # =================================================================
    # From Password back to Host: exactly 4 Shift+Tabs
    # (Password -> Username -> Check proxy -> Port -> Host)
    Send-ShiftTabKey
    Send-ShiftTabKey
    Send-ShiftTabKey
    Send-ShiftTabKey
    Start-Sleep -Milliseconds 40

    # From Host back to Type dropdown: 2 Shift+Tabs
    # (Host -> IP query channel -> Type)
    Send-ShiftTabKey
    Send-ShiftTabKey
    Start-Sleep -Milliseconds 40

    # =================================================================
    # STEP 3: FILL ONE BY ONE: TYPE -> HOST -> PORT -> USER -> PASS
    # =================================================================
    # 1. Select Type from dropdown
    Select-ProxyTypeInDropdown $Type

    # 2. Tab x 2 back to Host
    Send-TabKey
    Send-TabKey
    Clear-And-SetText $HostVal

    # 3. Tab to Port
    Send-TabKey
    Clear-And-SetText $PortVal

    # 4. Tab x 2 to Username
    Send-TabKey
    Send-TabKey
    Clear-And-SetText $UserVal

    # 5. Tab to Password
    Send-TabKey
    Clear-And-SetText $PassVal
    # Completed! Only fill marked fields. Do not click check proxy!
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
