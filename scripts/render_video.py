import asyncio
import os
import time
import subprocess
from playwright.async_api import async_playwright

TOTAL_DURATION = 32.661333
FPS = 30
TOTAL_FRAMES = int(TOTAL_DURATION * FPS)
WORKERS = 4
FRAMES_DIR = "video_assets/frames"

async def render_chunk(worker_id, start_frame, end_frame, html_path):
    print(f"[Worker {worker_id}] Starting frames {start_frame} to {end_frame}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto(f"file:///{html_path}")
        await page.wait_for_timeout(600)
        
        for f in range(start_frame, end_frame):
            t = f / FPS
            await page.evaluate(f"window.seekTime({t:.5f})")
            out_file = f"{FRAMES_DIR}/frame_{f:05d}.jpg"
            await page.screenshot(path=out_file, type="jpeg", quality=95)
            
            if (f - start_frame) % 50 == 0:
                print(f"[Worker {worker_id}] Frame {f}/{end_frame} (t={t:.2f}s)")
                
        await browser.close()
    print(f"[Worker {worker_id}] Done!")

async def main():
    os.makedirs(FRAMES_DIR, exist_ok=True)
    html_path = os.path.abspath("scripts/motion_renderer.html").replace("\\", "/")
    
    print(f"--- Starting Render: {TOTAL_FRAMES} frames @ {FPS}fps ({TOTAL_DURATION:.2f}s) ---")
    t0 = time.time()
    
    chunk_size = (TOTAL_FRAMES + WORKERS - 1) // WORKERS
    tasks = []
    
    for w in range(WORKERS):
        s = w * chunk_size
        e = min(TOTAL_FRAMES, (w + 1) * chunk_size)
        if s < TOTAL_FRAMES:
            tasks.append(render_chunk(w, s, e, html_path))
            
    await asyncio.gather(*tasks)
    t1 = time.time()
    print(f"\nAll frames rendered in {t1 - t0:.2f}s (Average {(TOTAL_FRAMES / (t1 - t0)):.1f} fps)")
    
    # Mux with FFmpeg
    print("\n--- Compiling Final Video with Master Soundtrack ---")
    output_video = "openstock_marketing_video.mp4"
    audio_path = "video_assets/audio/master_soundtrack.mp3"
    
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", f"{FRAMES_DIR}/frame_%05d.jpg",
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "320k",
        "-shortest",
        output_video
    ]
    
    res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("FFmpeg Compile Error:", res.stderr)
        raise RuntimeError("Video compilation failed")
        
    print(f"\nSUCCESS! Video saved to: {os.path.abspath(output_video)}")
    
    # Verify file info
    info = subprocess.check_output(f'ffprobe -v quiet -print_format json -show_format -show_streams {output_video}', shell=True)
    print("Video metadata verified.")

if __name__ == "__main__":
    asyncio.run(main())
