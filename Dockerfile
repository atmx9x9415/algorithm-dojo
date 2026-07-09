# Fly.io Dockerfile - Node.js Express App
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Remove .gitignore restriction on data dir for Fly volume
RUN mkdir -p /app/data

# Expose port (Fly.io uses PORT env var)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
