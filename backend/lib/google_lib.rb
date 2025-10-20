require "digest"
require "base64"
require_relative "protobuf/safebrowsing_pb"

module GoogleLib
  module SafeBrowsing
    THREAT_NAMES = {
      0 => "THREAT_TYPE_UNSPECIFIED",
      1 => "MALWARE",
      2 => "SOCIAL_ENGINEERING",
      3 => "UNWANTED_SOFTWARE",
      4 => "POTENTIALLY_HARMFUL_APPLICATION",
    }.freeze
    BASE_URL = "https://safebrowsing.googleapis.com/v5/hashes:search"

    class Api
      # https://developers.google.com/safe-browsing/reference
      def self.build_hash_prefix(url)
        full_hash_binary = Digest::SHA256.digest(url.strip.downcase)
        hash_prefix_binary = full_hash_binary[0..3]
        binding.irb
        Base64.urlsafe_encode64(hash_prefix_binary, padding: false)
      end

      def self.search(url)
        prefix_base64url = build_hash_prefix(url)
        uri = URI(BASE_URL)
        params = {
          key: ENV.fetch("GOOGLE_SAFE_LINK_KEY"),
          hashPrefixes: [prefix_base64url],
        }
        uri.query = URI.encode_www_form(params)

        # TODO: move to ENV
        response = HTTParty.get(uri.to_s, headers: { "Referer" => ENV.fetch("BASE_URL", "http://localhost") })
        result = Google::Security::Safebrowsing::V5::SearchHashesResponse.decode(response.body)

        returned = {
          safe: result.full_hashes.empty?,
          cache_duration: result.cache_duration&.seconds || 0,
          threats: format_threats(result.full_hashes, hash),
        }

        # TODO: Solve why tests are failing here
        # [GoogleLib::SafeBrowsing::Api.search] Response: {safe: true, cache_duration: 300, threats: []}
        puts "[GoogleLib::SafeBrowsing::Api.search] Response: #{returned.inspect}"
        
        returned
      end

      def self.format_threats(full_hashes, hash)
        full_hashes.map do |full_hash|
          {
            threat_type: THREAT_NAMES[full_hash.threat_type],
            platform_type: full_hash.platform_type,
            threat_entry_type: full_hash.threat_entry_type,
            threat: full_hash.threat.url,
            cache_duration: full_hash.cache_duration&.seconds || 0,
          }
        end
      end
    end

    class Services
      def self.check_url(url)
        # https://developers.google.com/safe-browsing/reference/rest/v5/hashes/search
        result = Api.search(url)

        result[:safe]
      rescue StandardError => e
        warn("[GoogleLib::SafeBrowsing::Services.check_url]: #{e.message}")
        false
      end
    end
  end
end
