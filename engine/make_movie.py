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

job_id = os.environ.get("JOB_ID", "fast_test_01")
narration = os.environ.get("NARRATION", "Welcome to our ultra fast 3D AI studio.")
custom_blender_code = os.environ.get("BLENDER_CODE", "").strip()
webhook_url = os.environ.get("WEBHOOK_URL", "").strip()

# 2. AUTO-CLEANUP: 5 Minute (300 sec) se purane videos delete karein
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

# 3. Voiceover Generate karein (Edge-TTS)
subprocess.run([
    "edge-tts",
    "--voice", "en-US-ChristopherNeural",
    "--text", narration,
    "--write-media", "voice.mp3"
], check=True)

duration_cmd = subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", "voice.mp3"
]).decode().strip()
audio_seconds = max(5, int(float(duration_cmd)) + 1)
fps = 20
total_frames = audio_seconds * fps

os.makedirs("frames", exist_ok=True)

# 4. TURBO CPU SPEED OPTIMIZER (1-2 Minute Render Guarantee)
speed_optimizer = """
import bpy
scene = bpy.context.scene
scene.render.resolution_x = 960
scene.render.resolution_y = 540
try:
    scene.eevee.taa_render_samples = 4
    scene.eevee.use_raytracing = False
    scene.eevee.use_shadows = False
except Exception:
    pass
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 88
scene.render.filepath = 'frames/frame_'
"""

# Default Colorful Test Scene (Blender 5.0 Principled BSDF + World Light)
default_scene = f"""
import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

for eng in ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE']:
    try:
        scene.render.engine = eng
        break
    except Exception:
        pass

scene.render.fps = {fps}
scene.frame_start = 1
scene.frame_end = {total_frames}

# Bright Studio World Background
world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.08, 0.14, 0.25, 1.0)
    bg.inputs[1].default_value = 1.2

# Camera & Lights
bpy.ops.object.camera_add(location=(0, -7, 2.5), rotation=(math.radians(75), 0, 0))
scene.camera = bpy.context.object

bpy.ops.object.light_add(type='SUN', location=(4, -4, 8))
bpy.context.object.data.energy = 3.0

# Colorful 3D Subject (Blender 5.0 Shader)
bpy.ops.mesh.primitive_monkey_add(size=2.2, location=(0, 0, 0.5))
obj = bpy.context.object
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new(name="BrightGoldMat")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.05, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.4
    bsdf.inputs["Roughness"].default_value = 0.25
obj.data.materials.append(mat)

obj.rotation_euler = (0, 0, 0)
obj.keyframe_insert(data_path="rotation_euler", frame=1)
obj.rotation_euler = (0, 0, math.radians(360))
obj.keyframe_insert(data_path="rotation_euler", frame={total_frames})

{speed_optimizer}
bpy.ops.render.render(animation=True)
"""

if custom_blender_code:
    if "bpy.ops.render.render" in custom_blender_code:
        script_to_run = custom_blender_code.replace(
            "bpy.ops.render.render",
            speed_optimizer + "\nbpy.ops.render.render"
        )
    else:
        script_to_run = custom_blender_code + "\n" + speed_optimizer + "\nbpy.ops.render.render(animation=True)"
else:
    script_to_run = default_scene

with open("scene_script.py", "w") as f:
    f.write(script_to_run)

subprocess.run(["blender", "-b", "-P", "scene_script.py"], check=True)

# 5. FFmpeg se HD MP4 aur Preview GIF banayein
subprocess.run([
    "ffmpeg", "-y", "-framerate", str(fps), "-i", "frames/frame_%04d.jpg",
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

if webhook_url:
    requests.post(webhook_url, json={
        "job_id": job_id,
        "status": "ready",
        "video_url": video_res["secure_url"],
        "preview_gif": gif_res["secure_url"],
        "created_at": created_timestamp
    })
