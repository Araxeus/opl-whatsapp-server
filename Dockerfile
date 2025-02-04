# Build Stage
FROM node:22-slim AS builder

# Install necessary tools and dependencies
RUN apt-get update && apt-get --no-install-recommends install -y \
    build-essential \
    ca-certificates \
    curl \
    unzip \
    git \
    zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl --proto "=https" -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/

# Set the working directory
WORKDIR /app

# Clone the repository and capture the latest commit hash
RUN git clone https://github.com/Araxeus/opl-whatsapp-server.git . \
    && export COMMIT_HASH=$(git rev-parse --short HEAD) \
    && echo $COMMIT_HASH > commit_hash.txt \
    && rm -rf .git

# Install dependencies and build the app
RUN bun install --production && npm install libsignal \
    && bun _build

# Runtime Stage
FROM node:22-alpine AS runtime

# Set the working directory
WORKDIR /app

# Copy built app and commit hash from builder
COPY --from=builder /app /app

# Set the commit hash as an environment variable
ENV COMMIT_HASH="unknown"  # Set a default value

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose the port
EXPOSE 3000

# Start the application with the commit hash exported
ENTRYPOINT ["/bin/sh", "-c", "export COMMIT_HASH=$(cat /app/commit_hash.txt) && exec node ./dist/server.js"]
