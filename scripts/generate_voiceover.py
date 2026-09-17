import asyncio
import os
import subprocess
import json
import edge_tts

VOICE = "en-US-ChristopherNeural"

# Crisp, cinematic, punchy lines tailored to the 32.6s timeline
SEGMENTS = [
    {
        "id": "vo_1",
        "text": "Introducing OpenStock. Real U.S. stocks, now on Solana.",
        "start": 2.2,
    },
    {
        "id": "vo_2",
        "text": "Launch your token. Pair with Nvidia, Apple, or Tesla. And earn creator royalties in real stock shares.",
        "start": 6.2,
    },
    {
        "id": "vo_3",
        "text": "One click. Instant mainnet liquidity.",
        "start": 17.0,
    },
    {
        "id": "vo_4",
        "text": "Merging culture with real equity liquidity.",
        "start": 21.0,
    },
    {
        "id": "vo_5",
        "text": "Stock-backed. Token-2022. 100% on-chain.",
        "start": 24.8,
    },
    {
        "id": "vo_6",
        "text": "OpenStock. Launch your stock pair today.",
        "start": 28.5,
    }
]

async def generate_voiceovers():
    os.makedirs("video_assets/audio", exist_ok=True)
    for seg in SEGMENTS:
        out_file = f"video_assets/audio/{seg['id']}.mp3"
        print(f"Generating {seg['id']}...")
        communicate = edge_tts.Communicate(seg['text'], VOICE, rate="+14%", pitch="+0Hz")
        await communicate.save(out_file)
        
        # Check duration
        out = subprocess.check_output(f'ffprobe -v quiet -print_format json -show_format {out_file}', shell=True)
        d = float(json.loads(out)['format']['duration'])
        print(f"Saved {out_file} (duration: {d:.2f}s, start: {seg['start']}s)")

if __name__ == "__main__":
    asyncio.run(generate_voiceovers())
