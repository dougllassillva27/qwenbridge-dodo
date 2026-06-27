FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Install dumb-init and gosu to handle process signals and permissions correctly
RUN apt-get update && apt-get install -y dumb-init gosu && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the application
COPY . .

# Set permissions and switch to non-root user via entrypoint
RUN mkdir -p /app/data/qwen_profiles && chown -R pwuser:pwuser /app && chmod +x /app/docker-entrypoint.sh

# Declare volumes for persistent data
VOLUME ["/app/data", "/app/qwen_profiles"]

EXPOSE 3000
ENV NODE_ENV=production PORT=3000 NODE_OPTIONS="--max-old-space-size=512 --expose-gc --max-semi-space-size=16"

# Use dumb-init and docker-entrypoint to avoid zombie processes and fix swarm permissions
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/index.ts"]
