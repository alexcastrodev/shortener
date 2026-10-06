module Push
  module Config
    extend self

    def public_key = ENV["VAPID_PUBLIC_KEY"].to_s

    def private_key = ENV["VAPID_PRIVATE_KEY"].to_s

    def subject = ENV["VAPID_SUBJECT"].to_s

    def enabled?
      [public_key, private_key, subject].all?(&:present?)
    end

    def vapid
      { subject: subject, public_key: public_key, private_key: private_key }
    end
  end
end
