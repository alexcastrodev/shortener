module ImageUpload
  extend self

  HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx"].freeze
  HEIF_BRANDS = ["mif1", "msf1"].freeze

  SIGNATURES = {
    "image/png" => ->(head) { head.start_with?("\x89PNG\r\n\x1A\n".b) },
    "image/jpeg" => ->(head) { head.start_with?("\xFF\xD8\xFF".b) },
    "image/webp" => ->(head) { head.start_with?("RIFF".b) && head[8, 4] == "WEBP".b },
    "image/heic" => ->(head) { head[4, 4] == "ftyp".b && HEIC_BRANDS.include?(head[8, 4]) },
    "image/heif" => ->(head) { head[4, 4] == "ftyp".b && HEIF_BRANDS.include?(head[8, 4]) },
  }.freeze

  def sniff(head)
    SIGNATURES.find { |_type, matches| matches.call(head.to_s.b) }&.first
  end

  def content_type(file)
    sniff(File.binread(file.tempfile.path, 12) || "".b)
  end

  def basic_error(file, max_size:)
    return "is required" unless file.respond_to?(:tempfile)
    return "must be at most #{max_size / 1.megabyte}MB" if file.size > max_size

    "must be a PNG, JPEG, WebP or HEIC image" if content_type(file).nil?
  end
end
