#!/usr/bin/env ruby
require_relative 'base'
include Shell

REGISTRY = '192.168.1.179:5001'
PROJECT_DIR = File.expand_path('..', __dir__)

image = { name: 'shortener-edge', tag: 'latest', dockerfile: '.ci/Dockerfile.deno', context: '.' }
publish_image(image)
