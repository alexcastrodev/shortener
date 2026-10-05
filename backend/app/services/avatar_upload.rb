# Avatars are accepted only as PNG, JPEG, WebP or HEIC/HEIF (iPhone photos),
# identified by their magic bytes. The declared Content-Type and filename
# are client-controlled, and an SVG (script-capable XML) renamed to .png
# must never reach the image pipeline or visitors. Whatever comes in,
# visitors only get the resized WebP variant (Page#avatar_url).
#
# Dimensions are read from the header only (libvips decodes lazily), so a
# small file declaring a gigantic canvas is rejected before it is stored or
# queued for OptimizeAvatarJob.
module AvatarUpload
  extend self

  def error_for(file)
    basic_error = ImageUpload.basic_error(file, max_size: Page::AVATAR_MAX_SIZE)
    return basic_error if basic_error

    dimensions_error(file.tempfile.path)
  end

  def content_type(file)
    ImageUpload.content_type(file)
  end

  private

  def dimensions_error(path)
    header = Vips::Image.new_from_file(path)
    too_wide = [header.width, header.height].max > Page::AVATAR_MAX_DIMENSION
    too_many_pixels = header.width * header.height > Page::AVATAR_MAX_PIXELS
    return "must be at most #{Page::AVATAR_MAX_DIMENSION}px per side and #{Page::AVATAR_MAX_PIXELS / 1_000_000} megapixels" if too_wide || too_many_pixels

    nil
  rescue Vips::Error
    "could not be read as an image"
  end
end
