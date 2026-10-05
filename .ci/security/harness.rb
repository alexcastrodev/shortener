require "net/http"
require "json"
require "base64"
require "openssl"
require "socket"

module Harness
  API = URI("http://api.kurz.fyi")
  Response = Struct.new(:status, :body, :headers) do
    def json
      JSON.parse(body)
    end
  end

  STATE = { results: [], failed: false, ip: 0, valkey: nil }

  module_function

  begin
    def results
      STATE[:results]
    end

    def failed?
      STATE[:failed]
    end

    def ip
      STATE[:ip] += 1
      n = STATE[:ip]
      "198.51.#{100 + (n / 250) % 3}.#{n % 250 + 1}"
    end

    def http(verb, path, body: nil, token: nil, ip: nil, headers: {}, raw: nil, chunked: false)
      request = Net::HTTP.const_get(verb.to_s.capitalize).new(path)
      request["CF-Connecting-IP"] = ip || self.ip
      request["Authorization"] = "Bearer #{token}" if token
      request["Content-Type"] = "application/json" unless body.nil? && raw.nil?
      headers.each { |key, value| request[key] = value }
      if chunked
        request["Transfer-Encoding"] = "chunked"
        request.body_stream = StringIO.new(raw)
      elsif raw
        request.body = raw
      elsif body
        request.body = JSON.generate(body)
      end
      response = Net::HTTP.start(Harness::API.host, Harness::API.port, read_timeout: 30) { |connection| connection.request(request) }
      Harness::Response.new(response.code.to_i, response.body.to_s, response.each_header.to_h)
    end

    def parallel(count)
      Array.new(count) { |index| Thread.new { yield(index) } }.map(&:value)
    end

    def check(id, description, priority: "M")
      detail = begin
        yield
        nil
      rescue StandardError, Exception => e
        "#{e.class}: #{e.message}"[0, 300]
      end
      verdict = detail ? "FAIL" : "PASS"
      STATE[:failed] = true if detail && priority == "M"
      STATE[:results] << [id, priority, verdict, description]
      puts format("%-8s %-2s %-5s %s%s", id, priority, verdict, description, detail ? "  (#{detail})" : "")
    end

    def expect(condition, message = "expectation failed")
      raise message unless condition
    end

    def expect_eq(expected, actual, label = nil)
      raise "#{label}: expected #{expected.inspect}, got #{actual.inspect}" unless expected == actual
    end

    def sql(query)
      ActiveRecord::Base.uncached { ActiveRecord::Base.connection.select_value(query) }
    end

    def rows(query)
      ActiveRecord::Base.uncached { ActiveRecord::Base.connection.select_rows(query) }
    end

    def database_text
      ActiveRecord::Base.uncached do
        connection = ActiveRecord::Base.connection
        connection.tables.reject { |table| table.start_with?("schema_", "ar_internal") }.to_h do |table|
          [table, connection.select_value("select coalesce(string_agg(t::text, ' '), '') from #{connection.quote_table_name(table)} t")]
        end
      end
    end

    def valkey
      STATE[:valkey] ||= Redis.new(url: ENV.fetch("REDIS_URL"))
    end
  end
end
