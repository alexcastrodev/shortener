require "vips"
require "image_processing/vips"
require "tempfile"

Vips.block_untrusted(true) if Vips.at_least_libvips?(8, 13)
Vips.cache_set_max(0)
Vips.concurrency_set(2)

class ImgprocApp
  MAX_BYTES = 10 * 1024 * 1024
  MAX_SIDE = 10_000
  MAX_PIXELS = 50_000_000
  OUTPUT_EDGE = 4096
  SIGNATURES = {
    png: ->(head) { head.start_with?("\x89PNG\r\n\x1A\n".b) },
    jpeg: ->(head) { head.start_with?("\xFF\xD8\xFF".b) },
    webp: ->(head) { head.start_with?("RIFF".b) && head[8, 4] == "WEBP".b },
    heif: ->(head) { head[4, 4] == "ftyp".b && ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].include?(head[8, 4]) },
  }.freeze

  def call(env)
    return respond(404, "not_found") unless env["PATH_INFO"] == "/convert" || env["PATH_INFO"] == "/up"
    return respond(200, "ok") if env["PATH_INFO"] == "/up"
    return respond(405, "method_not_allowed") unless env["REQUEST_METHOD"] == "POST"

    length = env["CONTENT_LENGTH"].to_i
    return respond(411, "length_required") if length <= 0
    return respond(413, "too_large") if length > MAX_BYTES

    body = env["rack.input"].read(length)
    return respond(400, "truncated") unless body && body.bytesize == length
    return respond(422, "unsupported_type") unless SIGNATURES.values.any? { |matches| matches.call(body.b) }

    convert(body)
  end

  private

  def convert(body)
    Tempfile.create(["in", ".bin"], binmode: true) do |input|
      input.write(body)
      input.flush
      header = Vips::Image.new_from_file(input.path)
      return respond(422, "dimensions") if [header.width, header.height].max > MAX_SIDE || header.width * header.height > MAX_PIXELS

      webp = ImageProcessing::Vips.source(input.path).loader(fail: true).resize_to_limit(OUTPUT_EDGE, OUTPUT_EDGE).convert("webp").saver(strip: true).call
      begin
        [200, { "content-type" => "image/webp", "cache-control" => "no-store" }, [webp.read]]
      ensure
        webp.close!
      end
    end
  rescue Vips::Error
    respond(422, "unreadable")
  end

  def respond(status, code)
    [status, { "content-type" => "application/json", "cache-control" => "no-store" }, ["{\"status\":\"#{code}\"}"]]
  end
end
