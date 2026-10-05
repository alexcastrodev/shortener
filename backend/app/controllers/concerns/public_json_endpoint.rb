module PublicJsonEndpoint
  extend ActiveSupport::Concern

  DEFAULT_BODY_LIMIT = 64.kilobytes

  included do
    prepend_before_action :require_json
    prepend_before_action :limit_body
  end

  private

  def body_limit
    DEFAULT_BODY_LIMIT
  end

  def limit_body
    return head(413) if request.content_length.to_i > body_limit

    body = request.body.read(body_limit + 1).to_s
    request.body.rewind
    head(413) if body.bytesize > body_limit
  end

  def require_json
    head(415) unless request.media_type == "application/json"
  end
end
