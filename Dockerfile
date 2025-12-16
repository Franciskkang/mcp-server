# Streamable HTTP MCP Server Dockerfile
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY build/ ./build/

# Expose port for HTTP server
EXPOSE 8000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Start the server
CMD ["node", "build/index.js"]

