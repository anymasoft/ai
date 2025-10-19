# ───────────────────────────────────────────
# 1. Use a stable Node LTS image (22-slim)
#    This tag provides both amd64 and arm64 variants.
#    BuildKit will pick the correct one for the current platform
# ───────────────────────────────────────────
FROM --platform=linux/amd64 node:22-slim

# ───────────────────────────────────────────
# 2. Minimal OS tooling
# ───────────────────────────────────────────
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    python3 \
    python3-pip \
    python-is-python3 \
    procps \
 && rm -rf /var/lib/apt/lists/*

# Allow pip installs in Debian 12+/Ubuntu 23.04+ environment
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# ───────────────────────────────────────────
# 2.1. Install Bun
# ───────────────────────────────────────────
RUN curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:$PATH"

# ───────────────────────────────────────────
# 2.1. Install Next.js CLI globally
# ───────────────────────────────────────────
RUN npm install -g next@latest eslint@latest

# ───────────────────────────────────────────
# 3. Build everything under /home/user/app
# ───────────────────────────────────────────
WORKDIR /home/user/app

# ───────────────────────────────────────────
# 4. Generate a brand‑new Next.js app with all
#    *default* answers (-y) and the latest versions
# ───────────────────────────────────────────
ENV CI=true

# ───────────────────────────────────────────
# 5.1. Configure npm to handle legacy peer deps
# ───────────────────────────────────────────
RUN npm config set legacy-peer-deps true \
 && npm config set fund false \
 && npm config set audit false

# ───────────────────────────────────────────
# 6.1. install dependencies
# ───────────────────────────────────────────
COPY . /home/user/app
RUN bun install

RUN bun add motion tailwindcss-animate tw-animate-css tailwind-merge clsx lucide-react react-icons
RUN bun add react-fast-marquee cobe @tabler/icons-react react-rough-notation @headlessui/react react-intersection-observer
RUN bun add -D eslint eslint-config-next
RUN bun add -D @eslint/eslintrc
RUN bun add -D estree-walker@2.0.2 @babel/parser 

# ───────────────────────────────────────────
# 7.1. Copy visual-edits folder into src/visual-edits
# ───────────────────────────────────────────
RUN mkdir -p /home/user/app/src/visual-edits
RUN mv visual-edits/ /home/user/app/src/

# ───────────────────────────────────────────
# 7.2. Copy ErrorReporter.tsx into src/components
# ───────────────────────────────────────────
RUN mv ErrorReporter.tsx /home/user/app/src/components/ErrorReporter.tsx
RUN mv global-error.tsx /home/user/app/src/app/global-error.tsx

# ───────────────────────────────────────────
# Clean up
# ───────────────────────────────────────────
RUN rm src/app/layout.tsx
RUN mv layout.tsx src/app/


