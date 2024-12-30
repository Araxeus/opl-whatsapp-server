# Use an official Node.js image as the base
FROM node:22

# Install Bun
RUN curl --proto "=https" -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/ \
    && rm -rf /root/.bun

# Set the working directory
WORKDIR /app

# Clone the repository
RUN apt-get update && apt-get --no-install-recommends install -y git \
    && git clone https://github.com/Araxeus/opl-whatsapp-server.git . \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies using Bun
RUN bun install --production --frozen-lockfile

# Build the application
RUN bun _build

# Switch to a non-root user
USER node

# Expose the port the app runs on (adjust if needed)
EXPOSE 3000

# Start the application
CMD ["node", "./dist/server.js"]
