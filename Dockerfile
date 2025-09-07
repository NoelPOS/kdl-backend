# Multi-stage build for NestJS + TypeORM backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build && \
    npm prune --production

# Production stage
FROM node:22-alpine AS runner

# Install dumb-init and wget for proper signal handling and health checks
RUN apk add --no-cache dumb-init wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Create necessary directories with proper ownership
RUN mkdir -p /app/public /app/dist && \
    chown -R nestjs:nodejs /app

# Copy built application and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/public ./public

# Switch to non-root user
USER nestjs

# Expose port (configurable via PORT env var, defaults to 3001)
EXPOSE ${PORT:-3001}

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
