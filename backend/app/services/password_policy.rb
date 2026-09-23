# NIST 800-63B: length over composition rules, and no passwords known from
# breaches. The breach check uses Have I Been Pwned's k-anonymity API: only
# the first 5 characters of the SHA-1 leave the server, and padded responses
# hide which prefix was asked. If the API is unreachable the password is
# accepted (length still applies).
module PasswordPolicy
  extend self

  MIN_LENGTH = 8
  # Argon2 accepts more, but hashing megabytes on request is a free DoS.
  MAX_LENGTH = 128
  RANGE_URL = "https://api.pwnedpasswords.com/range/"

  # nil when acceptable, otherwise an error code for the client.
  def error_for(password, email: nil)
    password = password.to_s
    return "password_too_short" if password.length < MIN_LENGTH
    return "password_too_long" if password.length > MAX_LENGTH
    return "password_matches_email" if email.present? && password.downcase.include?(email.to_s.split("@").first.downcase) && password.length < 16
    return "password_breached" if breached?(password)

    nil
  end

  def breached?(password)
    sha1 = Digest::SHA1.hexdigest(password).upcase
    prefix = sha1[0, 5]
    suffix = sha1[5..]

    uri = URI("#{RANGE_URL}#{prefix}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 3
    http.read_timeout = 4
    request = Net::HTTP::Get.new(uri)
    request["Add-Padding"] = "true"
    request["User-Agent"] = "Kurz (https://kurz.fyi)"
    body = http.request(request).body.to_s

    body.each_line.any? do |line|
      hash, count = line.strip.split(":")
      hash == suffix && count.to_i.positive?
    end
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, OpenSSL::SSL::SSLError => e
    Rails.logger.warn("[PasswordPolicy] breach check skipped: #{e.class}")
    false
  end
end
