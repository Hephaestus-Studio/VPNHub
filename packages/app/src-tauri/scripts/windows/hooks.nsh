!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Registering and starting VPNHub Daemon Service..."
  nsExec::ExecToLog 'sc.exe create "VPNHubDaemon" binPath= "\"$INSTDIR\vpnhub-daemon.exe\"" start= auto displayname= "VPNHub Daemon Service"'
  nsExec::ExecToLog 'sc.exe start "VPNHubDaemon"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping and removing VPNHub Daemon Service..."
  nsExec::ExecToLog 'sc.exe stop "VPNHubDaemon"'
  nsExec::ExecToLog 'sc.exe delete "VPNHubDaemon"'
!macroend
