import os
import time
import subprocess
import requests
import cloudinary
import cloudinary.api
import cloudinary.uploader
from datetime import datetime, timezone

# 1. Cloudinary Setup
cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"]
)

job_id = os.environ.get("JOB_ID", "demo_job")
narration = os.environ.get("NARRATION", "This is a 3D animated scene.")
custom_blender_code = os.environ.get("BLENDER_CODE", "").strip()
webhook_url = os.environ.get("WEBHOOK_URL", "").strip()

# 2. AUTO-CLEANUP: 5 Minute (300 sec) se purane saare videos permanent delete karein
def cleanup_old_videos():
    try:
        resources = cloudinary.api.resources(
            type="upload",
            resource_type="video",
            prefix="ai_3d_temp/",
            max_results=100
        )
        now = datetime.now(timezone.utc).timestamp()
        for item in resources.get("resources", []):
            created_str = item["created_at"]
            created_ts = datetime.strptime(created_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
            if (now - created_ts) > 300:
                cloudinary.uploader.destroy(item["public_id"], resource_type="video")
                print(f"Deleted expired video: {item['public_id']}")
    except Exception as e:
        print("Cleanup check skipped:", e)

cleanup_old_videos()

# 3. Voiceover Generate karein (Edge-TTS - 100% Free)
subprocess.run([
    "edge-tts",
    "--voice", "en-US-ChristopherNeural",
    "--text", narration,
    "--write-media", "voice.mp3"
], check=True)

# Audio ki length nikalna taaki 3D video utna hi lamba bane
duration_cmd = subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", "voice.mp3"
]).decode().strip()
audio_seconds = max(5, int(float(duration_cmd)) + 1)
total_frames = audio_seconds * 24

os.makedirs("frames", exist_ok=True)

# 4. Blender 5.0 Compatible Python Script
default_scene = f"""
import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Render Engine (Blender 4 & 5 compatible)
for eng in ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH']:
    try:
        scene.render.engine = eng
        break
    except Exception:
        pass

scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = {total_frames}

# Camera & Lighting
bpy.ops.object.camera_add(location=(0, -8, 3), rotation=(math.radians(75), 0, 0))
scene.camera = bpy.context.object

bpy.ops.object.light_add(type='SUN', location=(4, -4, 8))
bpy.ops.object.light_add(type='AREA', location=(-4, -3, 5))
bpy.context.object.data.energy = 150.0

# 3D Animated Subject
bpy.ops.mesh.primitive_monkey_add(size=2, location=(0, 0, 1))
obj = bpy.context.object
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new(name="HeroMat")
mat.diffuse_color = (0.1, 0.6, 0.9, 1.0)
obj.data.materials.append(mat)

# Keyframe Animation
obj.rotation_euler = (0, 0, 0)
obj.keyframe_insert(data_path="rotation_euler", frame=1)
obj.rotation_euler = (0, 0, math.radians(360))
obj.keyframe_insert(data_path="rotation_euler", frame={total_frames})

# PNG Frames render karein
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = 'frames/frame_'
bpy.ops.render.render(animation=True)
"""

script_to_run = custom_blender_code if custom_blender_code else default_scene
with open("scene_script.py", "w") as f:
    f.write(script_to_run)

# Headless Blender chalakar 3D frames render karein
subprocess.run(["blender", "-b", "-P", "scene_script.py"], check=True)

# 5. FFmpeg se PNG Frames + Voiceover jodkar HD MP4 aur Preview GIF banayein
subprocess.run([
    "ffmpeg", "-y", "-framerate", "24", "-i", "frames/frame_%04d.png",
    "-i", "voice.mp3", "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", "final_movie.mp4"
], check=True)

subprocess.run([
    "ffmpeg", "-y", "-t", "3", "-i", "final_movie.mp4",
    "-vf", "fps=10,scale=480:-1", "preview.gif"
], check=True)

# 6. Cloudinary par upload karein
video_res = cloudinary.uploader.upload(
    "final_movie.mp4",
    resource_type="video",
    public_id=f"ai_3d_temp/{job_id}"
)

gif_res = cloudinary.uploader.upload(
    "preview.gif",
    resource_type="image",
    public_id=f"ai_3d_temp/{job_id}_preview"
)

created_timestamp = int(time.time())
print("RENDER_COMPLETE:", video_res["secure_url"])

# 7. MCP Server ko batayein ki video taiyar hai
if webhook_url:
    requests.post(webhook_url, json={
        "job_id": job_id,
        "status": "ready",
        "video_url": video_res["secure_url"],
        "preview_gif": gif_res["secure_url"],
        "created_at": created_timestamp
    })
