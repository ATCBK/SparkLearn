param([string]$OutputPath, [string]$Text)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.Volume = 100
$s.SetOutputToWaveFile($OutputPath)
$s.Speak($Text)
$s.Dispose()