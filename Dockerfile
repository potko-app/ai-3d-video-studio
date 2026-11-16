FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    wget xz-utils ffmpeg xvfb python3 python3-pip \
    libegl1 libgl1 libglx-mesa0 libxkbcommon-x11-0 libsm6 libxext6 libxrender1 libxi6 \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz \
    && tar -xf blender-4.2.3-linux-x64.tar.xz -C /opt/ \
    && ln -s /opt/blender-4.2.3-linux-x64/blender /usr/local/bin/blender \
    && rm blender-4.2.3-linux-x64.tar.xz

RUN pip3 install --no-cache-dir fastapi uvicorn edge-tts requests

WORKDIR /app
COPY app.py /app/app.py

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
