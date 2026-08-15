#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef AppNumericVersion
  #define AppNumericVersion "0.0.0.0"
#endif
#ifndef StageRoot
  #error StageRoot must point to the prepared BetterCodex release payload.
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

[Setup]
AppId={{8B31B46E-7A28-4C93-9B58-27A4D6258367}
AppName=BetterCodex
AppVersion={#AppVersion}
AppVerName=BetterCodex {#AppVersion}
AppPublisher=BetterCodex
AppPublisherURL=https://github.com/ijsbeerdev/BetterCodex
AppSupportURL=https://github.com/ijsbeerdev/BetterCodex/issues
AppUpdatesURL=https://github.com/ijsbeerdev/BetterCodex/releases/latest
VersionInfoVersion={#AppNumericVersion}
VersionInfoDescription=BetterCodex Setup
DefaultDirName={localappdata}\Programs\BetterCodex
DefaultGroupName=BetterCodex
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=bettercodex-{#AppVersion}-windows-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
RestartApplications=no
CloseApplications=yes
UninstallDisplayIcon={app}\BetterCodex.Manager.exe
UninstallDisplayName=BetterCodex
Uninstallable=yes
#ifdef SignToolName
SignTool={#SignToolName}
SignedUninstaller=yes
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autostart"; Description: "Start BetterCodex with Windows"; GroupDescription: "Background watcher:"; Flags: checkedonce

[Files]
Source: "{#StageRoot}\runtime\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageRoot}\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageRoot}\Install-Actions.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageRoot}\Install-Actions.ps1"; Flags: dontcopy

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "BetterCodex"; ValueData: """{app}\BetterCodex.Manager.exe"" --startup"; Flags: uninsdeletevalue; Tasks: autostart

[Icons]
Name: "{group}\BetterCodex"; Filename: "{app}\BetterCodex.Manager.exe"
Name: "{group}\Uninstall BetterCodex"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\Install-Actions.ps1"" -Action CompleteInstall"; StatusMsg: "Finishing migration from the preview installer…"; Flags: runhidden waituntilterminated
Filename: "{app}\BetterCodex.Manager.exe"; Description: "Start BetterCodex"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\BetterCodex.Manager.exe"; Parameters: "--shutdown"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopManager"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\Install-Actions.ps1"" -Action StopCurrent"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopRuntime"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  ScriptPath: String;
begin
  Result := '';
  ExtractTemporaryFile('Install-Actions.ps1');
  ScriptPath := ExpandConstant('{tmp}\Install-Actions.ps1');
  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '" -Action PrepareInstall',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode
  ) then
    Result := 'BetterCodex could not stop the previous watcher before installation.';
  if (Result = '') and (ResultCode <> 0) then
    Result := 'BetterCodex migration failed with exit code ' + IntToStr(ResultCode) + '. See the Setup log for details.';
end;
