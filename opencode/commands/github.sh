#!/bin/bash

docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token) ghcr.io/github/github-mcp-server
