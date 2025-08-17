# Build Stage
FROM node:24-alpine AS builder

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

# Should disable cache for next step
RUN date +%s
# Clone the repository
RUN git clone https://github.com/Araxeus/opl-whatsapp-server.git . \
    && rm -rf .git

# Install dependencies and build the app
RUN bun install --production \
&& npm install WhiskeySockets/libsignal-node --legacy-peer-deps \
&& bun _build

###############
# Runtime Stage
###############

FROM node:24-alpine AS runtime

# Copy built app and dependencies from builder
WORKDIR /app
COPY --from=builder /app /app

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "./dist/server.js"]
