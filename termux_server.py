import os, re, shutil, subprocess, requests
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
CLOUDINARY_CLOUD = "cltgefea"
UPLOAD_PRESET = "ml_default"

class VideoJob(BaseModel):
    job_id: str
    narration: str = ""
    blender_code: str

@app.get("/")
def health():
    return {"status": "online", "engine": "Kinetra3D Termux ARM64 Pre-Installed Blender Engine"}

@app.post("/render")
def render_now(job: VideoJob):
    work_dir = f"/tmp/{job.job_id}"
    os.makedirs(work_dir, exist_ok=True)
    try:
        setup_script = """
import bpy
scene = bpy.context.scene
if not any(o.type == 'CAMERA' for o in scene.objects):
    bpy.ops.object.camera_add(location=(0, -9, 4.5), rotation=(1.15, 0, 0))
    scene.camera = bpy.context.active_object
if not any(o.type == 'LIGHT' for o in scene.objects):
    bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))

scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 8
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.fps = 15
if scene.frame_end > 225:
    scene.frame_end = 225
scene.render.image_settings.file_format = 'PNG'
"""
        py_file = f"{work_dir}/scene.py"
        with open(py_file, "w", encoding="utf-8") as f:
            f.write(job.blender_code + "\n" + setup_script)

        # Instant Pre-Installed Blender Render (Zero Download Delay)
        subprocess.run(
            ["xvfb-run", "-a", "blender", "-b", "-P", py_file, "-o", f"{work_dir}/frame_", "-F", "PNG", "-x", "1", "-a"],
            check=True, timeout=300
        )

        raw_mp4 = f"{work_dir}/raw.mp4"
        final_mp4 = f"{work_dir}/final.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", "15", "-i", f"{work_dir}/frame_%04d.png", "-c:v", "libx264", "-pix_fmt", "yuv420p", raw_mp4],
            check=True
        )

        # AI Voiceover (Hindi / English Auto)
        if job.narration.strip():
            voice_mp3 = f"{work_dir}/voice.mp3"
            voice = "hi-IN-MadhurNeural" if re.search(r'[\u0900-\u097F]', job.narration) else "en-US-ChristopherNeural"
            subprocess.run(["edge-tts", "--text", job.narration.strip(), "--voice", voice, "--write-media", voice_mp3], check=False)
            if os.path.exists(voice_mp3):
                subprocess.run(["ffmpeg", "-y", "-i", raw_mp4, "-i", voice_mp3, "-c:v", "copy", "-c:a", "aac", "-shortest", final_mp4], check=True)
            else:
                shutil.copy(raw_mp4, final_mp4)
        else:
            shutil.copy(raw_mp4, final_mp4)

        # Upload Ready MP4 to Cloudinary
        with open(final_mp4, "rb") as vf:
            res = requests.post(
                f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD}/video/upload",
                files={"file": vf},
                data={"public_id": job.job_id, "upload_preset": UPLOAD_PRESET}
            ).json()

        return {"status": "success", "video_url": res.get("secure_url")}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
