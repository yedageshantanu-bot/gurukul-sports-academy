# 🎙️ MANDATORY RULE: AUTOMATIC HINDI AUDIO REPORTING

Whenever Antigravity reports back to the user with a task completion summary, status walkthrough, or implementation plan:

1. **Automatic Audio Report Generation:**
   Antigravity MUST generate a 1–2 minute spoken audio report in Hindi using the zero-cost neural voice model (`hi-IN-MadhurNeural` via `edge-tts`). If Hindi is unavailable or English is requested, Indian English (`en-IN-PrabhatNeural`) may be used.

2. **Zero Cost Invariant:**
   Never use paid TTS APIs (ElevenLabs, OpenAI TTS, Google Cloud TTS) that incur billing. Always use the free local Microsoft Edge Neural TTS runner located at:
   `c:\Users\ADMIN\OneDrive\Desktop\GURUKUL SPORTS ACADEMY\.agents\skills\hindi-audio-reporter\scripts\generate_audio.py`

3. **No Technical Jargon on Admin ERP:**
   Never expose technical backend/database terms like "Supabase", "PostgreSQL", or internal database engine names in the user-facing admin UI. Replace them with user-friendly terms like "Cloud Database", "Academy Server", or "Synchronized".

4. **Output Requirements:**
   Every report response MUST include:
   - Clickable link to the generated `.mp3` file.
   - An embedded HTML `<audio controls>` player in the chat or artifact.
   - A concise bulleted Hindi / Hinglish summary of what is spoken in the audio.
