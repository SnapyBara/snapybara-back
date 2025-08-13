FROM node:20-alpine AS base

RUN apk add --no-cache dumb-init curl

WORKDIR /usr/src/app

# ==========================================
# STAGE: Dependencies
# ==========================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# ==========================================
# STAGE: Build dependencies
# ==========================================
FROM dependencies AS build-dependencies

# Install ALL dependencies (including devDependencies)
RUN npm ci --include=dev

# ==========================================
# STAGE: Build
# ==========================================
FROM build-dependencies AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==========================================
# STAGE: Production
# ==========================================
FROM base AS production

# Copy production dependencies
COPY --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy built application
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./

# Create necessary directories
RUN mkdir -p uploads logs && \
    chmod 755 uploads logs

# Use non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    chown -R nestjs:nodejs /usr/src/app

USER nestjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1