RSpec.shared_context("authenticated user") do
  let(:current_user) { User.create!(email: "test+#{SecureRandom.hex(4)}@example.com") }
  let(:auth_token) { JWT.encode({ sub: current_user.id }, Rails.application.secret_key_base, "HS256") }
  let(:auth_headers) { { "Authorization" => "Bearer #{auth_token}" } }
end
