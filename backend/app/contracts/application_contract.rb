# frozen_string_literal: true

class ApplicationContract < Dry::Validation::Contract
  # https://dry-rb.org/gems/dry-validation/1.6/macros/#macro-with-options
  register_macro(:min_size) do |macro:|
    min = macro.args[0]
    key.failure("must have at least #{min} elements") if value.size < min
  end

  register_macro(:email_format) do
    key.failure("must be a valid email") if value.present? && !URI::MailTo::EMAIL_REGEXP.match?(value)
  end

  # Only http(s) URLs with a host may become redirect targets; rejects
  # javascript:, data:, file: and other schemes.
  register_macro(:http_url) do
    next if value.nil?

    uri = URI.parse(value.strip)
    valid = uri.is_a?(URI::HTTP) && uri.host.present?
    key.failure("must be a valid http or https URL") unless valid
  rescue URI::InvalidURIError
    key.failure("must be a valid http or https URL")
  end
end
