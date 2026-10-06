module CoverUpload
  extend self

  MAX_SIZE = 5.megabytes
  MAX_DIMENSION = 8_000
  MAX_PIXELS = 40_000_000
  TYPES = ["image/png", "image/jpeg", "image/webp"].freeze

  def error_for(file)
    problem = ImageUpload.basic_error(file, max_size: MAX_SIZE)
    return problem if problem
    return "must be a PNG, JPEG or WebP image" unless TYPES.include?(ImageUpload.content_type(file))

    dimensions_error(file.tempfile.path)
  end

  private

  def dimensions_error(path)
    header = Vips::Image.new_from_file(path)
    return "must be at most #{MAX_DIMENSION}px per side and #{MAX_PIXELS / 1_000_000} megapixels" if [header.width, header.height].max > MAX_DIMENSION || header.width * header.height > MAX_PIXELS

    nil
  rescue Vips::Error
    "could not be read as an image"
  end
end
