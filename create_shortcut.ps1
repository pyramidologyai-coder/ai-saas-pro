$WshShell = New-Object -comObject WScript.Shell

# Shortcut for Project Folder
$Shortcut1 = $WshShell.CreateShortcut("$HOME\Desktop\AI_Clinic_Project.lnk")
$Shortcut1.TargetPath = "C:\Users\Ahmad\.gemini\antigravity\scratch\ai-saas-clinics-restaurants"
$Shortcut1.Description = "Open AI Clinic Project Folder"
$Shortcut1.Save()

# Shortcut for Start Script
$Shortcut2 = $WshShell.CreateShortcut("$HOME\Desktop\Start_AI_Clinic.lnk")
$Shortcut2.TargetPath = "C:\Users\Ahmad\.gemini\antigravity\scratch\ai-saas-clinics-restaurants\Start_AI_Clinic.bat"
$Shortcut2.WorkingDirectory = "C:\Users\Ahmad\.gemini\antigravity\scratch\ai-saas-clinics-restaurants"
$Shortcut2.Description = "Start AI Clinic Server and WhatsApp Tunnel"
$Shortcut2.Save()
