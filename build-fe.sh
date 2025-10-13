#!/bin/bash
set -euo pipefail

echo "Building Docker image: Frontend"
if ! docker build -t shortener-frontend -f .ci/Dockerfile.frontend .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Deployment complete."
exit 0