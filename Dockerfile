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
ARG REPO_URL=https://github.com/Araxeus/opl-whatsapp-server.git
RUN git clone $REPO_URL . \
    && export COMMIT_HASH=$(git rev-parse --short HEAD) \
    && rm -rf .git

# Set the commit hash as a build argument
ARG COMMIT_HASH
ENV COMMIT_HASH=$COMMIT_HASH

# Install dependencies and build the app
RUN bun install --production && npm install libsignal \
    && bun _build

# Runtime Stage
FROM node:22-alpine AS runtime

# Set the working directory
WORKDIR /app

# Copy built app and environment variable from builder
COPY --from=builder /app /app
ENV COMMIT_HASH=$COMMIT_HASH

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "./dist/server.js"]
