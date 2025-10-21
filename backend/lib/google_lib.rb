require "httparty"

module GoogleLib
  module SafeBrowsing
    module V4
      class Services
        def self.check_url(url)
          uri = URI("https://safebrowsing.googleapis.com/v4/threatMatches:find")
          uri.query = URI.encode_www_form(key: ENV.fetch("GOOGLE_SAFE_LINK_KEY"))

          response = HTTParty.post(
            uri.to_s,
            body: body(url).to_json,
            headers: { "Content-Type" => "application/json", "Referer" => ENV.fetch("BASE_URL", "http://localhost") },
          )

          response.parsed_response.fetch("matches", []).empty?
        rescue StandardError
          false
        end

        def self.body(url)
          {
            "client": {
              "clientId": "kurz",
              "clientVersion": "1.5.2",
            },
            "threatInfo": {
              "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
              "platformTypes": ["WINDOWS"],
              "threatEntryTypes": ["URL"],
              "threatEntries": [
                { "url": url },
              ],
            },
          }
        end
      end
    end
  end
end
