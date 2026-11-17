param(
  [Parameter(Mandatory)][ValidateSet('recognize','speak')][string] $Mode,
  [Parameter(Mandatory)][string] $InputPath,
  [string] $OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
if ($Mode -eq 'speak') {
  $voice = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  try {
    $voice.SetOutputToWaveFile($OutputPath)
    $voice.Speak([IO.File]::ReadAllText($InputPath))
  } finally {
    $voice.Dispose()
  }
} else {
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new()
  try {
    $engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
    $engine.SetInputToWaveFile($InputPath)
    $parts = [Collections.Generic.List[string]]::new()
    Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier MedusaSpeech | Out-Null
    Register-ObjectEvent -InputObject $engine -EventName RecognizeCompleted -SourceIdentifier MedusaDone | Out-Null
    $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
    while ($event = Wait-Event -Timeout 30) {
      Remove-Event -EventIdentifier $event.EventIdentifier
      if ($event.SourceIdentifier -eq 'MedusaDone') { break }
      if ($event.SourceIdentifier -eq 'MedusaSpeech') {
        $parts.Add($event.SourceEventArgs.Result.Text)
      }
    }
    [Console]::Write(($parts -join ' '))
  } finally {
    $engine.Dispose()
  }
}
