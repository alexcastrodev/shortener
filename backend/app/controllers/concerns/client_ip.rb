# Public traffic reaches the API through Cloudflare Tunnel, which sets
# CF-Connecting-IP to the real client IP (same rule as the edge function's
# extractIpAddress). request.remote_ip is only a fallback for local
# development, where there is no tunnel.
module ClientIp
  extend ActiveSupport::Concern

  private

  # Only a well-formed IP is trusted: the value is used as a rate-limit key,
  # stored, and interpolated into the ip-api.com lookup URL (IpaddrJob).
  def client_ip
    header = request.headers["CF-Connecting-IP"].to_s.strip
    IPAddr.new(header).to_s
  rescue IPAddr::InvalidAddressError, IPAddr::AddressFamilyError
    request.remote_ip
  end
end
