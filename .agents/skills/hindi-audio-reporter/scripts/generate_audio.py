import argparse
import asyncio
import os
import sys

def get_voice(lang: str) -> str:
    if lang.lower().startswith("en"):
        return "en-IN-PrabhatNeural"  # or en-IN-NeerjaNeural
    return "hi-IN-MadhurNeural"       # Free, studio-grade Indian Hindi neural voice

async def generate(text: str, output_path: str, lang: str = "hi", rate: str = "+0%"):
    import edge_tts
    voice = get_voice(lang)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    communicator = edge_tts.Communicate(text, voice, rate=rate)
    await communicator.save(output_path)
    print(f"[hindi-audio-reporter] Successfully generated audio at: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Zero-cost Hindi/English Audio Reporter using edge-tts")
    parser.add_argument("--text", type=str, help="Text to speak")
    parser.add_argument("--file", type=str, help="Path to text file to speak")
    parser.add_argument("--output", type=str, default="report_audio.mp3", help="Output MP3 path")
    parser.add_argument("--lang", type=str, default="hi", help="Language: 'hi' (Hindi) or 'en' (English)")
    parser.add_argument("--rate", type=str, default="+0%", help="Speaking rate offset, e.g. +5% or -5%")

    args = parser.parse_args()

    content = ""
    if args.file and os.path.exists(args.file):
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read().strip()
    elif args.text:
        content = args.text.strip()
    else:
        print("Error: Either --text or --file must be provided.", file=sys.stderr)
        sys.exit(1)

    if not content:
        print("Error: Empty text provided.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(generate(content, args.output, args.lang, args.rate))

if __name__ == "__main__":
    main()
