class Oauth::RegistrationsController < Oauth::BaseController
  include ClientIp
  include PublicJsonEndpoint

  prepend_before_action :require_enabled

  GRANT_TYPES = ["authorization_code", "refresh_token"].freeze

  rate_limit to: 10,
    within: 1.hour,
    name: "oauth_register",
    by: -> { client_ip },
    with: -> { oauth_error("temporarily_unavailable", "Too many registrations", status: :too_many_requests) }

  def create
    metadata = request.request_parameters
    return oauth_error("invalid_client_metadata", "Public clients only") unless metadata.fetch("token_endpoint_auth_method", "none") == "none"
    return oauth_error("invalid_client_metadata", "Unsupported grant_types") unless Array(metadata.fetch("grant_types", GRANT_TYPES)).all? { |type| GRANT_TYPES.include?(type) }
    return oauth_error("invalid_redirect_uri") unless metadata["redirect_uris"].is_a?(Array) && metadata["redirect_uris"].all?(String)

    name = metadata["client_name"].to_s.gsub(/[\p{Cc}\p{Cf}]/, "").strip
    client = OauthClient.new(client_name: name.presence || "Unnamed app", redirect_uris: metadata["redirect_uris"])
    unless client.save
      return oauth_error(client.errors.key?(:redirect_uris) ? "invalid_redirect_uri" : "invalid_client_metadata")
    end

    render(
      json: {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        token_endpoint_auth_method: "none",
        grant_types: GRANT_TYPES,
        response_types: ["code"],
      },
      status: :created,
    )
  end

  private

  def body_limit
    5.kilobytes
  end
end
