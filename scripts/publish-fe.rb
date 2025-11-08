#!/usr/bin/env ruby
require_relative 'base'
include Shell

REGISTRY = 'pifive:5002'
PROJECT_DIR = File.expand_path('..', __dir__)

image = { name: 'shortener-frontend', tag: 'latest', dockerfile: '.ci/Dockerfile.frontend', context: '.' }
publish_image(image)
