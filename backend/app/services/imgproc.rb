require "net/http"

module Imgproc
  extend self

  class Unavailable < StandardError; end
  class Rejected < StandardError; end

  OPEN_TIMEOUT = 2
  READ_TIMEOUT = 25

  def convert(bytes)
    uri = URI.join(ENV.fetch("IMGPROC_URL"), "/convert")
    http = Net::HTTP.new(uri.host, uri.port)
    http.open_timeout = OPEN_TIMEOUT
    http.read_timeout = READ_TIMEOUT
    http.write_timeout = READ_TIMEOUT
    response = http.post(uri.path, bytes, "Content-Type" => "application/octet-stream")

    case response.code.to_i
    when 200 then response.body
    when 411, 413, 422 then raise Rejected
    else raise Unavailable
    end
  rescue KeyError, SystemCallError, Timeout::Error, IOError, SocketError
    raise Unavailable
  end
end
