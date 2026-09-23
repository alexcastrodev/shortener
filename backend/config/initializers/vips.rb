# Avatars are the only images libvips ever sees, and they come from users.
#
# - Loaders libvips flags as untrusted (ImageMagick, MATLAB, FITS, ...) are
#   blocked. AvatarUpload already filters by magic bytes; this is defense in
#   depth against a loader bug.
# - No operation cache and at most two worker threads per image, so one
#   decode of a 48MP HEIC stays well inside the jobs container's memory.
require "vips"

Vips.block_untrusted(true) if Vips.at_least_libvips?(8, 13)
Vips.cache_set_max(0)
Vips.concurrency_set(2)
