---
name: hindi-audio-reporter
description: Automatically generates a 1-2 minute zero-cost neural audio status report in Hindi (or English) whenever Antigravity reports to the user, gives a completion summary, or presents a plan. Powered by local edge-tts (hi-IN-MadhurNeural).
---

# Hindi Audio Reporter Skill (हिंदी ऑडियो रिपोर्टर)

## Purpose & Mandate
Whenever Antigravity finishes a development milestone, solves a bug, presents a plan, or delivers a walkthrough report to the user, Antigravity **MUST** automatically generate a 1 to 2 minute conversational audio report in Hindi (or English if requested).

This ensures the user can listen to the progress immediately on mobile or desktop without reading through long technical documents.

## Key Rules
1. **Zero Cost Only:** Use the built-in Microsoft Edge Neural TTS (`hi-IN-MadhurNeural`) via `edge-tts`. **Cost is ₹0.00 / $0.00** (Zero API fees, no subscriptions).
2. **Audio Duration:** 1 to 2 minutes (~150 to 250 words in Hindi at normal conversational speed).
3. **Tone:** Natural, friendly, respectful, and clear (conversational Hindi/Hinglish, speaking directly to the user as a partner/brother).
4. **Content:**
   - What was accomplished or fixed.
   - Clarifications on questions raised by the user.
   - Verification status and live links.
5. **Output Delivery:**
   - Save MP3 to the artifact directory: `<artifactDir>/report_audio.mp3` or workspace audio file.
   - Provide clickable file link `[report_audio.mp3](file://...)`.
   - Embed an HTML5 `<audio controls>` player in the chat response or walkthrough artifact.
   - Provide a short 3-5 bullet point transcript in Devanagari Hindi or Hinglish.

## Execution Command
To generate the audio, run:
```powershell
python "c:\Users\ADMIN\OneDrive\Desktop\GURUKUL SPORTS ACADEMY\.agents\skills\hindi-audio-reporter\scripts\generate_audio.py" --text "नमस्ते भाई! ..." --output "<artifactDir>\report_audio.mp3" --lang "hi"
```
Or pass a text file:
```powershell
python "c:\Users\ADMIN\OneDrive\Desktop\GURUKUL SPORTS ACADEMY\.agents\skills\hindi-audio-reporter\scripts\generate_audio.py" --file "path\to\script.txt" --output "<artifactDir>\report_audio.mp3" --lang "hi"
```

## Language Options
- **Hindi (Default):** `--lang hi` (Voice: `hi-IN-MadhurNeural`, natural Indian Hindi male neural voice).
- **English (Fallback):** `--lang en` (Voice: `en-IN-PrabhatNeural`, Indian English neural voice).
