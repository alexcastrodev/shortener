require "httparty"

module GoogleLib
  module SafeBrowsing
    module V4
      class Services
        class Error < StandardError; end

        # threatMatches:find accepts at most 500 entries per request.
        MAX_BATCH = 500

        def self.check_url(url)
          find_matches(url).fetch("matches", []).empty?
        rescue StandardError
          false
        end

        # The subset of urls that Safe Browsing flags. Unlike check_url, a
        # failed request raises instead of reporting everything as unsafe, so
        # callers can retry later rather than act on a transient error.
        def self.unsafe_urls(urls)
          urls = Array(urls)
          raise ArgumentError, "at most #{MAX_BATCH} urls per request" if urls.size > MAX_BATCH
          return Set.new if urls.empty?

          response = find_matches(urls)
          raise Error, "Safe Browsing request failed with #{response.code}" unless response.success?

          response.parsed_response.fetch("matches", []).map { |match| match.dig("threat", "url") }.to_set
        end

        def self.find_matches(urls)
          uri = URI("https://safebrowsing.googleapis.com/v4/threatMatches:find")
          uri.query = URI.encode_www_form(key: ENV.fetch("GOOGLE_SAFE_LINK_KEY"))

          HTTParty.post(
            uri.to_s,
            body: body(urls).to_json,
            headers: { "Content-Type" => "application/json", "Referer" => ENV.fetch("BASE_URL", "http://localhost") },
          )
        end

        def self.body(urls)
          {
            "client": {
              "clientId": "kurz",
              "clientVersion": "1.5.2",
            },
            "threatInfo": {
              "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
              "platformTypes": ["WINDOWS"],
              "threatEntryTypes": ["URL"],
              "threatEntries": Array(urls).map { |url| { "url": url } },
            },
          }
        end
      end
    end
  end
end
