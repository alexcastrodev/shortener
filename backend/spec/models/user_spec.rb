# == Schema Information
#
# Table name: users
#
#  id                       :bigint           not null, primary key
#  admin                    :boolean          default(FALSE), not null
#  deactivated_at           :datetime
#  email                    :string           not null
#  failed_password_attempts :integer          default(0), not null
#  login_attempts           :integer          default(0), not null
#  login_token              :string
#  login_token_sent_at      :datetime
#  password_changed_at      :datetime
#  password_digest          :string
#  password_locked_until    :datetime
#  pending_password_digest  :string
#  sessions_revoked_at      :datetime
#  shortlinks_count         :integer          default(0), not null
#  verified_at              :datetime
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#
# Indexes
#
#  index_users_on_lower_email                 (lower((email)::text)) UNIQUE
#  index_users_on_verified_at_and_created_at  (verified_at,created_at)
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

  describe "login token" do
    it "may be the same code for two users" do
      a = User.create!(email: "a@example.com")
      b = User.create!(email: "b@example.com")
      allow(SecureRandom).to(receive(:random_number).and_return(1234567))
      a.generate_login_token!
      expect { b.generate_login_token! }.not_to(raise_error)
      expect(b.reload.login_token).to(eq(a.reload.login_token))
    end
  end

  describe "time zone" do
    it "is Europe/Lisbon until the user chooses another one, and is still any zone that exists" do
      user = User.create!(email: "zone@example.com")
      expect(user.time_zone).to(eq("Europe/Lisbon"))

      expect(user.update(time_zone: "America/Sao_Paulo")).to(be(true))
      expect(user.update(time_zone: "UTC")).to(be(true))
      expect(user.update(time_zone: "Mars/Olympus")).to(be(false))
    end

    it "is the zone a new booking question starts with" do
      user = User.create!(email: "owner@example.com")

      expect(Forms::BookingSchema.defaults({}, user)["rules"]["time_zone"]).to(eq("Europe/Lisbon"))
    end
  end
end
