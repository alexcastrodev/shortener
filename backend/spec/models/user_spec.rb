# == Schema Information
#
# Table name: users
#
#  id                  :bigint           not null, primary key
#  admin               :boolean          default(FALSE), not null
#  email               :string           not null
#  login_token         :string
#  login_token_sent_at :datetime
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_users_on_login_token  (login_token) UNIQUE
#  index_users_on_lower_email  (lower((email)::text)) UNIQUE
#
require "rails_helper"

RSpec.describe(User, type: :model) do
  describe "email uniqueness" do
    it "ensures email uniqueness regardless of case" do
      User.create!(email: "test@example.com")
      user2 = User.build(email: "TEST@EXAMPLE.COM")

      expect(user2).not_to(be_valid)
      expect(user2.errors[:email]).to(include("has already been taken"))
    end

    it "stores email in lowercase" do
      user = User.create!(email: "Test@Example.COM")

      expect(user.email).to(eq("test@example.com"))
    end
  end
end
