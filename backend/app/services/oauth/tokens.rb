module Oauth
  module Tokens
    extend self

    PREFIXES = { access: "kz_at_", refresh: "kz_rt_", code: "kz_ac_" }.freeze

    def generate(kind)
      "#{PREFIXES.fetch(kind)}#{SecureRandom.urlsafe_base64(32)}"
    end

    def digest(raw)
      OpenSSL::Digest::SHA256.hexdigest(raw.to_s)
    end

    def kind?(raw, kind)
      raw.is_a?(String) && raw.start_with?(PREFIXES.fetch(kind)) && raw.length <= 128
    end
  end
end
