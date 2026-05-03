#!/usr/bin/env ruby
require_relative 'base'
include Shell

REGISTRY = 'pifive:5001'
PROJECT_DIR = File.expand_path('..', __dir__)

image = { name: 'shortener', tag: 'latest', dockerfile: '.ci/Dockerfile', context: '.' }
publish_image(image)