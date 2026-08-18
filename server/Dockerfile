FROM docker.m.daocloud.io/library/python:3.12-slim

WORKDIR /app

ARG APT_MIRROR=mirrors.aliyun.com
ARG PIP_INDEX=https://mirrors.aliyun.com/pypi/simple
ARG PIP_TRUSTED_HOST=mirrors.aliyun.com

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
    fi; \
    apt-get update && apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      libgl1 \
      libgomp1 \
      libsm6 \
      libxext6 \
      libxrender1 \
      fonts-wqy-microhei \
      fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir \
    -i "${PIP_INDEX}" \
    --trusted-host "${PIP_TRUSTED_HOST}" \
    -r requirements.txt

COPY app ./app
RUN mkdir -p temp

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
