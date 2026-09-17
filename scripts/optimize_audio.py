import asyncio
import os
import subprocess
import json
import edge_tts

VOICE = "en-US-ChristopherNeural"

# Target non-overlapping segments aligned to video scene transitions:
# Scene 1: 0.0s - 4.5s
# Scene 2: 4.5s - 9.2s
# Scene 3: 9.2s - 14.0s
# Scene 4: 14.0s - 19.0s
# Scene 5: 19.0s - 23.5s
# Scene 6: 23.5s - 27.5s
# Scene 7: 27.5s - 32.6s

SEGMENTS = [
    {
        "id": "vo_1",
        "text": "Welcome to OpenStock. Real tokenized stocks on Solana.",
        "start": 0.4,
        "rate": "+34%"
    },
    {
        "id": "vo_2",
        "text": "Trade Apple, Nvidia, and Tesla twenty-four seven with deep liquidity.",
        "start": 4.6,
        "rate": "+30%"
    },
    {
        "id": "vo_3",
        "text": "Backed one-to-one by real shares with live Pyth benchmarks.",
        "start": 9.4,
        "rate": "+30%"
    },
    {
        "id": "vo_4",
        "text": "Launch community tokens paired against stocks, and earn creator royalties.",
        "start": 14.2,
        "rate": "+30%"
    },
    {
        "id": "vo_5",
        "text": "Bonding curves migrate automatically to concentrated Meteora pools.",
        "start": 19.2,
        "rate": "+30%"
    },
    {
        "id": "vo_6",
        "text": "Track your portfolio and claim stock rewards in real time.",
        "start": 23.6,
        "rate": "+30%"
    },
    {
        "id": "vo_7",
        "text": "OpenStock. Real stocks on Solana.",
        "start": 28.5,
        "rate": "+20%"
    }
]

async def generate():
    os.makedirs("video_assets/audio", exist_ok=True)
    all_clean = True
    results = []
    for i, seg in enumerate(SEGMENTS):
        out_file = f"video_assets/audio/{seg['id']}.mp3"
        comm = edge_tts.Communicate(seg['text'], VOICE, rate=seg['rate'])
        await comm.save(out_file)
        cmd = f'ffprobe -v quiet -print_format json -show_format {out_file}'
        out = subprocess.check_output(cmd, shell=True)
        d = float(json.loads(out)['format']['duration'])
        end_t = seg['start'] + d
        next_start = SEGMENTS[i+1]['start'] if i+1 < len(SEGMENTS) else 32.66
        gap = next_start - end_t
        results.append((seg['id'], seg['start'], d, end_t, gap))
        if gap < 0:
            all_clean = False
            print(f"[OVERLAP] {seg['id']}! ends at {end_t:.2f}s but next starts at {next_start:.2f}s (overlap: {-gap:.2f}s)")
        else:
            print(f"[OK] {seg['id']}: start={seg['start']:.2f}s, dur={d:.2f}s, end={end_t:.2f}s, gap={gap:.2f}s")
            
    if all_clean:
        print("\nAll voiceovers are 100% cleanly separated with breathing gaps!")
        # Now mix master soundtrack
        mix_soundtrack()

def mix_soundtrack():
    inputs = ["-i", "reference_audio.mp3"]
    filter_parts = ["[0:a]volume=0.72[music]"]
    amix_inputs = ["[music]"]
    
    for i, seg in enumerate(SEGMENTS):
        vo_path = f"video_assets/audio/{seg['id']}.mp3"
        inputs.extend(["-i", vo_path])
        delay_ms = int(seg['start'] * 1000)
        input_idx = i + 1
        filter_parts.append(f"[{input_idx}:a]adelay={delay_ms}|{delay_ms},volume=1.35[vo_{i}]")
        amix_inputs.append(f"[vo_{i}]")
        
    amix_str = "".join(amix_inputs) + f"amix=inputs={len(amix_inputs)}:duration=first:dropout_transition=2,alimiter=limit=0.95[aout]"
    filter_parts.append(amix_str)
    
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", ";".join(filter_parts), "-map", "[aout]", "-c:a", "libmp3lame", "-b:a", "320k", "video_assets/audio/master_soundtrack.mp3"]
    subprocess.run(cmd, check=True)
    print("Master soundtrack generated successfully!")

if __name__ == "__main__":
    asyncio.run(generate())
