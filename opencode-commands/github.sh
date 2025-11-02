#!/bin/bash

docker run -i --rm --network=host \
    -e GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token) \
    -e GITHUB_TOOLSETS="repos,issues,pull_requests" \
    -e GITHUB_READ_ONLY=1 \
    ghcr.io/github/github-mcp-server
