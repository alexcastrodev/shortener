RSpec.shared_context("authenticated user") do
  let(:current_user) { User.create!(email: "test+#{SecureRandom.hex(4)}@example.com") }
  let(:auth_token) { SessionToken.issue(current_user) }
  let(:auth_headers) { { "Authorization" => "Bearer #{auth_token}" } }

  let(:current_admin_user) { User.create!(email: "test+#{SecureRandom.hex(4)}@example.com", admin: true) }
  let(:admin_auth_token) { SessionToken.issue(current_admin_user) }
  let(:admin_auth_headers) { { "Authorization" => "Bearer #{admin_auth_token}" } }
end
