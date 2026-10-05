module ClientIp
  extend ActiveSupport::Concern

  private

  def client_ip
    forwarded_ip || cloudflare_ip || request.remote_ip
  end

  def cloudflare_ip
    well_formed(request.headers["CF-Connecting-IP"])
  end

  def forwarded_ip
    secret = ENV["SSR_FORWARD_SECRET"].to_s
    given = request.headers["X-Ssr-Secret"].to_s
    return if secret.empty? || given.empty? || !ActiveSupport::SecurityUtils.secure_compare(given, secret)

    well_formed(request.headers["X-Visitor-Ip"])
  end

  def well_formed(value)
    IPAddr.new(value.to_s.strip).to_s
  rescue IPAddr::InvalidAddressError, IPAddr::AddressFamilyError
    nil
  end
end
