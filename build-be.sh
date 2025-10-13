#!/bin/bash
set -euo pipefail

echo "Building Docker image: shortener:latest"
if ! docker build -t shortener:latest -f .ci/Dockerfile .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Building Docker image: Edge"
if ! docker build -t shortener-edge -f .ci/Dockerfile.deno .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Deployment complete."
exit 0