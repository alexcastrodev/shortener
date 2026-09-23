require "rails_helper"

RSpec.describe(PasswordAuthenticatable) do
  let(:user) { User.create!(email: "hash@example.com", verified_at: Time.current) }

  it "stores Argon2id hashes, never the password" do
    user.change_password!("correct horse battery")

    expect(user.password_digest).to(start_with("$argon2id$v=19$m=32768,t=2,p=1$"))
    expect(user.password_digest).not_to(include("correct horse battery"))
  end

  it "upgrades hashes made with weaker parameters on the next sign-in" do
    user.update!(password_digest: Argon2::Password.create("correct horse battery", t_cost: 1, m_cost: 12))

    expect(user.authenticate_password("correct horse battery")).to(be(true))
    expect(user.reload.password_digest).to(include("m=32768,t=2,p=1"))
  end
end
