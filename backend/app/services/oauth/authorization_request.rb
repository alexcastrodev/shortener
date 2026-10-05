module Oauth
  class AuthorizationRequest
    CHALLENGE = /\A[A-Za-z0-9\-_]{43}\z/
    STATE_MAX = 512

    attr_reader :client, :error, :redirectable

    def initialize(params)
      @params = params
      validate
    end

    def valid?
      error.nil?
    end

    def scopes
      @scopes ||= @params[:scope].to_s.split.uniq
    end

    def redirect_uri
      @params[:redirect_uri].to_s
    end

    def code_challenge
      @params[:code_challenge].to_s
    end

    def resource
      @params[:resource].presence || Config.resource
    end

    def state
      @params[:state].to_s.first(STATE_MAX).presence
    end

    def redirect_url(extra)
      uri = URI.parse(redirect_uri)
      query = URI.decode_www_form(uri.query.to_s) + extra.merge(state: state, iss: Config.issuer).compact.to_a.map { |key, value| [key.to_s, value.to_s] }
      uri.query = URI.encode_www_form(query)
      uri.to_s
    end

    private

    def validate
      @client = OauthClient.find_by(client_id: @params[:client_id].to_s.first(64))
      return fail_with("invalid_client", redirectable: false) unless client
      return fail_with("invalid_redirect_uri", redirectable: false) unless client.redirect_uri?(redirect_uri)

      return fail_with("unsupported_response_type") unless @params[:response_type] == "code"
      return fail_with("invalid_request") unless @params[:code_challenge_method] == "S256" && code_challenge.match?(CHALLENGE)
      return fail_with("invalid_scope") unless scopes.any? && (scopes - OauthGrant::SCOPES).empty?
      return fail_with("invalid_scope") if scopes.intersect?(OauthGrant::APPOINTMENT_SCOPES) && !Appointments::Config.enabled?

      fail_with("invalid_target") unless resource == Config.resource
    end

    def fail_with(code, redirectable: true)
      @error = code
      @redirectable = redirectable
    end
  end
end
