import asyncio
import os
import subprocess
import json
import edge_tts

VOICE = "en-US-ChristopherNeural"

SEGMENTS = [
    {
        "id": "vo_1",
        "text": "Welcome to OpenStock. Real tokenized stocks, live on Solana.",
        "start": 0.8,
        "rate": "+25%"
    },
    {
        "id": "vo_2",
        "text": "Trade Apple, Nvidia, and Tesla twenty-four seven with deep liquidity.",
        "start": 4.8,
        "rate": "+25%"
    },
    {
        "id": "vo_3",
        "text": "Backed one-to-one by genuine shares with real-time Pyth oracles.",
        "start": 9.6,
        "rate": "+25%"
    },
    {
        "id": "vo_4",
        "text": "Launch community tokens paired against stocks, and earn creator royalties.",
        "start": 14.3,
        "rate": "+25%"
    },
    {
        "id": "vo_5",
        "text": "Bonding curves graduate automatically into Meteora DLMM pools.",
        "start": 19.3,
        "rate": "+25%"
    },
    {
        "id": "vo_6",
        "text": "Track holdings and claim stock rewards directly in your portfolio.",
        "start": 23.8,
        "rate": "+25%"
    },
    {
        "id": "vo_7",
        "text": "OpenStock. Real stocks. On Solana.",
        "start": 28.5,
        "rate": "+15%"
    }
]

async def check():
    os.makedirs("video_assets/audio", exist_ok=True)
    for seg in SEGMENTS:
        out_file = f"video_assets/audio/{seg['id']}.mp3"
        communicate = edge_tts.Communicate(seg['text'], VOICE, rate=seg['rate'], pitch="+0Hz")
        await communicate.save(out_file)
        cmd = f'ffprobe -v quiet -print_format json -show_format {out_file}'
        out = subprocess.check_output(cmd, shell=True)
        d = float(json.loads(out)['format']['duration'])
        end_t = seg['start'] + d
        print(f"{seg['id']}: start={seg['start']:.1f}s, duration={d:.2f}s, end={end_t:.2f}s")

if __name__ == "__main__":
    asyncio.run(check())
