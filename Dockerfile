# Copyright 2026 Google LLC
# Production-ready secure container configuration

FROM node:21-alpine

# Install static file server
RUN npm install -g http-server

# Set working directory
WORKDIR /app

# Copy package specifications and install dependencies
COPY package.json ./
RUN npm install

# Copy source code and entrypoint
COPY ./src /app
COPY ./server.js /app/server.js
COPY ./entrypoint.sh /app/entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Expose server port
EXPOSE 8080

# Configure secure runtime key injection
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
