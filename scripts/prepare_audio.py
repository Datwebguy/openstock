import asyncio
import os
import subprocess
import json
import edge_tts

VOICE = "en-US-ChristopherNeural"

# Precisely timed segments matching the platform flows and beat drops
SEGMENTS = [
    {
        "id": "vo_1",
        "text": "Welcome to OpenStock. Real tokenized U.S. equities, live on Solana.",
        "start": 0.8,
        "rate": "+24%"
    },
    {
        "id": "vo_2",
        "text": "Trade twenty-four seven with live Pyth benchmarks and deep Meteora liquidity.",
        "start": 4.8,
        "rate": "+24%"
    },
    {
        "id": "vo_3",
        "text": "Institutional-grade price feeds, backed one-to-one by genuine underlying shares.",
        "start": 9.8,
        "rate": "+24%"
    },
    {
        "id": "vo_4",
        "text": "Launch community tokens paired against Apple, Nvidia, or Tesla, and earn royalties in real stock.",
        "start": 14.5,
        "rate": "+24%"
    },
    {
        "id": "vo_5",
        "text": "Bonding curves migrate automatically to concentrated Meteora DLMM pools.",
        "start": 19.2,
        "rate": "+22%"
    },
    {
        "id": "vo_6",
        "text": "Track your portfolio and claim stock royalties in real time.",
        "start": 23.5,
        "rate": "+22%"
    },
    {
        "id": "vo_7",
        "text": "OpenStock. Trade stocks. Launch pairs. Built on Solana.",
        "start": 28.2,
        "rate": "+20%"
    }
]

async def generate_voiceovers():
    os.makedirs("video_assets/audio", exist_ok=True)
    for seg in SEGMENTS:
        out_file = f"video_assets/audio/{seg['id']}.mp3"
        print(f"Generating {seg['id']}...")
        communicate = edge_tts.Communicate(seg['text'], VOICE, rate=seg['rate'], pitch="+0Hz")
        await communicate.save(out_file)
        
        # Check duration
        cmd = f'ffprobe -v quiet -print_format json -show_format {out_file}'
        out = subprocess.check_output(cmd, shell=True)
        d = float(json.loads(out)['format']['duration'])
        print(f"Saved {out_file} (duration: {d:.2f}s, start: {seg['start']}s)")

def build_master_soundtrack():
    print("\n--- Mixing Master Soundtrack with FFmpeg ---")
    # Base reference audio is reference_audio.mp3
    # We will mix reference_audio.mp3 (music/beat at volume 0.75) with each VO segment delayed to its start time (volume 1.25)
    
    inputs = ["-i", "reference_audio.mp3"]
    filter_parts = []
    
    # Music input is [0:a]
    filter_parts.append("[0:a]volume=0.72[music]")
    
    amix_inputs = ["[music]"]
    for i, seg in enumerate(SEGMENTS):
        vo_path = f"video_assets/audio/{seg['id']}.mp3"
        inputs.extend(["-i", vo_path])
        delay_ms = int(seg['start'] * 1000)
        input_idx = i + 1
        # Apply delay and slight compression/eq for broadcast clarity
        filter_parts.append(
            f"[{input_idx}:a]adelay={delay_ms}|{delay_ms},volume=1.35,highpass=f=80,lowpass=f=12000[vo_{i}]"
        )
        amix_inputs.append(f"[vo_{i}]")
    
    total_mix_count = len(amix_inputs)
    amix_str = "".join(amix_inputs) + f"amix=inputs={total_mix_count}:duration=first:dropout_transition=2,alimiter=limit=0.95[aout]"
    filter_parts.append(amix_str)
    
    filter_complex = ";".join(filter_parts)
    
    output_audio = "video_assets/audio/master_soundtrack.mp3"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-c:a", "libmp3lame",
        "-b:a", "320k",
        output_audio
    ]
    
    print("Running FFmpeg audio mix...")
    res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("FFmpeg Error:", res.stderr)
        raise RuntimeError("FFmpeg audio mix failed")
    print(f"Master soundtrack generated: {output_audio}")

if __name__ == "__main__":
    asyncio.run(generate_voiceovers())
    build_master_soundtrack()
