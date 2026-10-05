require "vips"

Vips.block_untrusted(true) if Vips.at_least_libvips?(8, 13)
Vips.cache_set_max(0)
Vips.concurrency_set(2)
