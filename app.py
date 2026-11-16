import os, re, shutil, subprocess, requests
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CLOUDINARY_CLOUD = "cltgefea"
UPLOAD_PRESET = "ml_default"
JOBS = {}

class RenderRequest(BaseModel):
    job_id: str
    narration: str = ""
    blender_code: str

def process_video(job_id: str, narration: str, blender_code: str):
    work_dir = f"/tmp/{job_id}"
    os.makedirs(work_dir, exist_ok=True)
    JOBS[job_id] = {
        "status": "in_progress",
        "stage": "Initializing 3D Scene...",
        "progress": 5,
        "current_frame": 0,
        "total_frames": 150,
        "conclusion": None
    }

    try:
        fixer = """
import bpy
for addon in ['rigify', 'ant_landscape', 'node_wrangler']:
    try: bpy.ops.preferences.addon_enable(module=addon)
    except Exception: pass

scene = bpy.context.scene
if not any(obj.type == 'CAMERA' for obj in scene.objects):
    bpy.ops.object.camera_add(location=(0, -10, 5), rotation=(1.15, 0, 0))
    scene.camera = bpy.context.active_object

if not any(obj.type == 'LIGHT' for obj in scene.objects):
    bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))

scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_samples = 8
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.fps = 15
if scene.frame_end > 150:
    scene.frame_end = 150
print(f"TOTAL_FRAMES_INFO:{scene.frame_end}", flush=True)
scene.render.image_settings.file_format = 'PNG'
"""
        script_path = f"{work_dir}/scene.py"
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(blender_code + "\n" + fixer)

        process = subprocess.Popen(
            ["xvfb-run", "-a", "blender", "-b", "-P", script_path, "-o", f"{work_dir}/frame_", "-F", "PNG", "-x", "1", "-a"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        total_frames = 150
        for line in process.stdout:
            if "TOTAL_FRAMES_INFO:" in line:
                try:
                    total_frames = int(line.split("TOTAL_FRAMES_INFO:")[1].strip())
                    JOBS[job_id]["total_frames"] = total_frames
                except Exception:
                    pass
            match = re.search(r"Fra:(\d+)", line)
            if match:
                cur = int(match.group(1))
                pct = min(80, 10 + int((cur / max(1, total_frames)) * 70))
                JOBS[job_id].update({
                    "stage": f"Rendering Frame {cur}/{total_frames}",
                    "current_frame": cur,
                    "progress": pct
                })

        process.wait(timeout=300)
        if process.returncode != 0:
            raise RuntimeError("Blender rendering failed")

        JOBS[job_id].update({"stage": "Compiling Video & AI Voice...", "progress": 85})
        raw_mp4 = f"{work_dir}/raw.mp4"
        final_mp4 = f"{work_dir}/final.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", "15", "-i", f"{work_dir}/frame_%04d.png", "-c:v", "libx264", "-pix_fmt", "yuv420p", raw_mp4],
            check=True
        )

        if narration.strip():
            voice_mp3 = f"{work_dir}/voice.mp3"
            voice = "hi-IN-MadhurNeural" if re.search(r'[\u0900-\u097F]', narration) else "en-US-ChristopherNeural"
            subprocess.run(["edge-tts", "--text", narration.strip(), "--voice", voice, "--write-media", voice_mp3], check=False)
            if os.path.exists(voice_mp3):
                subprocess.run(["ffmpeg", "-y", "-i", raw_mp4, "-i", voice_mp3, "-c:v", "copy", "-c:a", "aac", "-shortest", final_mp4], check=True)
            else:
                shutil.copy(raw_mp4, final_mp4)
        else:
            shutil.copy(raw_mp4, final_mp4)

        JOBS[job_id].update({"stage": "Uploading to Cloud...", "progress": 95})
        with open(final_mp4, "rb") as vf:
            res = requests.post(
                f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD}/video/upload",
                files={"file": vf},
                data={"public_id": job_id, "upload_preset": UPLOAD_PRESET}
            )
            res.raise_for_status()

        JOBS[job_id].update({
            "status": "completed",
            "stage": "Ready to Watch",
            "progress": 100,
            "conclusion": "success"
        })
    except Exception as e:
        JOBS[job_id].update({
            "status": "completed",
            "stage": "Error",
            "conclusion": "failure",
            "error": str(e)
        })
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

@app.get("/")
def home():
    return {"status": "online", "engine": "Kinetra3D GitHub-Synced 24/7 Engine"}

@app.post("/render")
def start_render(req: RenderRequest, bg: BackgroundTasks):
    JOBS[req.job_id] = {"status": "queued", "stage": "In Queue...", "progress": 2, "conclusion": None}
    bg.add_task(process_video, req.job_id, req.narration, req.blender_code)
    return {"started": True, "job_id": req.job_id}

@app.get("/status/{job_id}")
def check_status(job_id: str):
    return JOBS.get(job_id, {"status": "unknown", "stage": "Booting...", "progress": 0, "conclusion": None})
