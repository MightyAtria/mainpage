#!/bin/bash

# Ensure we stop on any errors
set -e

echo "Starting deployment process..."

# Step 1: Ensure npm dependencies are installed (mostly useful if pulling straight from git)
echo "Installing dependencies..."
npm ci

# Step 2: Extract configurations using Node
DOMAIN=$(node -p "require('./config.json').domain")
WEB_PREFIX=$(node -p "require('./config.json').web_prefix")
DEPLOY_PATH=$(node -p "require('./config.json').nginx_deploy_path")

echo "Target Domain: $DOMAIN"
echo "Web Prefix: $WEB_PREFIX"
echo "Nginx Deploy Path: $DEPLOY_PATH"

# Step 3: Build the application
# We can inject WEB_PREFIX by passing varying base path (Vite supports --base)
echo "Building the TypeScipt app using Vite..."
npx vite build --base="$WEB_PREFIX"

# Step 4: Validate target deployment path and use sudo to deploy
if [ ! -d "$DEPLOY_PATH" ]; then
    echo "Warning: Deploy path $DEPLOY_PATH does not exist. Creating it now..."
    sudo mkdir -p "$DEPLOY_PATH"
fi

echo "Copying distribution files to $DEPLOY_PATH ..."
# Sync files to avoid leaving old artifacts but this is a simple copy.
sudo rsync -av --delete dist/ "$DEPLOY_PATH/"

# Step 5: Reload Nginx (Optional: You can customize your Nginx config to point to $DEPLOY_PATH and domain)
echo "Reloading Nginx to apply any changes..."
sudo systemctl reload nginx

echo "Deployment completed successfully!"
