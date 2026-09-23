# Avatars are accepted only as PNG, JPEG, WebP or HEIC/HEIF (iPhone photos),
# identified by their magic bytes. The declared Content-Type and filename
# are client-controlled, and an SVG (script-capable XML) renamed to .png
# must never reach the image pipeline or visitors. Whatever comes in,
# visitors only get the resized WebP variant (Page#avatar_url).
module AvatarUpload
  extend self

  # HEIF files are ISO BMFF containers: "ftyp" at byte 4, then a brand.
  HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx"].freeze
  HEIF_BRANDS = ["mif1", "msf1"].freeze

  SIGNATURES = {
    "image/png" => ->(head) { head.start_with?("\x89PNG\r\n\x1A\n".b) },
    "image/jpeg" => ->(head) { head.start_with?("\xFF\xD8\xFF".b) },
    "image/webp" => ->(head) { head.start_with?("RIFF".b) && head[8, 4] == "WEBP".b },
    "image/heic" => ->(head) { head[4, 4] == "ftyp".b && HEIC_BRANDS.include?(head[8, 4]) },
    "image/heif" => ->(head) { head[4, 4] == "ftyp".b && HEIF_BRANDS.include?(head[8, 4]) },
  }.freeze

  def error_for(file)
    return "is required" unless file.respond_to?(:tempfile)
    return "must be at most #{Page::AVATAR_MAX_SIZE / 1.megabyte}MB" if file.size > Page::AVATAR_MAX_SIZE
    return "must be a PNG, JPEG, WebP or HEIC image" if content_type(file).nil?

    nil
  end

  def content_type(file)
    head = File.binread(file.tempfile.path, 12) || "".b
    SIGNATURES.find { |_type, matches| matches.call(head) }&.first
  end
end
