class PushSubscriptionContract < ApplicationContract
  params do
    required(:endpoint).filled(:string, max_size?: 2048)
    required(:p256dh).filled(:string)
    required(:auth).filled(:string)
  end
end
