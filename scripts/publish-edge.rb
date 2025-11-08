#!/usr/bin/env ruby
require_relative 'base'
include Shell

REGISTRY = 'pifive:5002'
PROJECT_DIR = File.expand_path('..', __dir__)

image = { name: 'shortener-edge', tag: 'latest', dockerfile: '.ci/Dockerfile.deno', context: '.' }
publish_image(image)
