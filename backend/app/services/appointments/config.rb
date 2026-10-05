module Appointments
  module Config
    extend self

    def enabled?
      ENV["APPOINTMENTS_ENABLED"] == "true"
    end

    def allowed_emails
      ENV["APPOINTMENTS_ALLOWED_EMAILS"].to_s.split(",").map { |email| email.strip.downcase }.reject(&:empty?)
    end

    def enabled_for?(user)
      return false unless enabled? && user

      allowed = allowed_emails
      allowed.empty? || allowed.include?(user.email.to_s.downcase)
    end
  end
end
