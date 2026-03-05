# Stage 1: Build the React application
FROM node:20-slim AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy the build output from the first stage
COPY --from=build /app/dist /usr/share/nginx/html

# We'll use the main nginx config instead of copying it here, 
# or we can copy a basic one and mount the real one via docker-compose.
# For simplicity, we'll let docker-compose handle the nginx config mounting.

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
