# Copyright 2026 Google LLC
# Production-ready secure container configuration

FROM node:21-alpine

# Set working directory
WORKDIR /app

# Copy package specifications and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code and all configuration files
COPY . /app

# Build the React production client bundle
RUN npm run build

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Expose server port
EXPOSE 8080

# Configure secure runtime key injection
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
