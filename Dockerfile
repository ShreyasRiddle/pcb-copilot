FROM node:20-slim

# C extension build deps needed by SKiDL's transitive dependencies (lxml, etc.)
RUN apt-get update && \
    apt-get install -y \
        python3 python3-pip python3-venv \
        build-essential libxml2-dev libxslt-dev \
        --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install SKiDL 0.0.36 (last stable pre-1.0 release whose API matches our prompts)
# and its peer dependencies into an isolated venv
RUN python3 -m venv /opt/skidl-env && \
    /opt/skidl-env/bin/pip install --upgrade pip && \
    /opt/skidl-env/bin/pip install "skidl==0.0.36" kinparse kicad-skip

# Point the Next.js server at the venv Python binary
ENV SKIDL_PYTHON=/opt/skidl-env/bin/python3

WORKDIR /app

# Layer-cache Node deps separately from source
COPY package*.json ./
RUN npm ci

# Copy source and build Next.js
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
