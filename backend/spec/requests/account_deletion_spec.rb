require "rails_helper"

RSpec.describe("Account deletion", type: :request) do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { FactoryBot.create(:user, email: "leaving@example.com") }
  let(:headers) { { "Authorization" => "Bearer #{SessionToken.issue(user)}" } }
  let!(:link) { user.shortlinks.create!(original_url: "https://example.com/a") }

  before { host! "localhost" }

  def delete_account(params = { confirm_email: user.email }, hdrs = headers)
    delete("/api/me", params: params, headers: hdrs, as: :json)
  end

  describe "DELETE /api/me" do
    it "schedules deletion in 30 days, takes everything offline, ends the session and tells the user" do
      freeze_time do
        expect { delete_account }.to(have_enqueued_mail(AccountMailer, :deletion_scheduled))

        expect(response).to(have_http_status(:accepted))
        expect(JSON.parse(response.body)["deletion_due_at"]).to(eq(30.days.from_now.iso8601))
      end
      user.reload
      expect(user).to(be_pending_deletion)
      expect(user.deactivated_at).not_to(be_nil)
      expect(link.reload.inactive_at).not_to(be_nil)
      get("/api/me", headers: headers)
      expect(response).to(have_http_status(:forbidden))
    end

    it "revokes OAuth grants" do
      client = OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"])
      grant = OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")

      delete_account

      expect(grant.reload).not_to(be_active)
    end

    it "needs the email typed exactly" do
      delete_account({ confirm_email: "other@example.com" })

      expect(response).to(have_http_status(:unprocessable_content))
      expect(user.reload).not_to(be_pending_deletion)
    end

    it "asks for the current password when there is one" do
      user.change_password!("a-long-enough-password-1")
      fresh = { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }

      delete_account({ confirm_email: user.email, current_password: "wrong" }, fresh)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(user.reload).not_to(be_pending_deletion)

      delete_account({ confirm_email: user.email, current_password: "a-long-enough-password-1" }, fresh)
      expect(response).to(have_http_status(:accepted))
    end

    it "asks for a recent sign-in when the account has no password" do
      old = { "Authorization" => "Bearer #{travel_to(1.hour.ago) { SessionToken.issue(user) }}" }

      delete_account({ confirm_email: user.email }, old)

      expect(response).to(have_http_status(:forbidden))
      expect(JSON.parse(response.body)["error"]).to(eq("reauthentication_required"))
    end

    it "requires a session" do
      delete_account({ confirm_email: user.email }, {})

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "changing your mind" do
    it "restores the account and its links when the user signs in again with an emailed code" do
      delete_account
      user.reload.generate_login_token!

      post("/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json)

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)["deletion_cancelled"]).to(be(true))
      user.reload
      expect(user).not_to(be_pending_deletion)
      expect(user.deactivated_at).to(be_nil)
      expect(link.reload.inactive_at).to(be_nil)
    end

    it "does not claim a cancellation when there was nothing to cancel" do
      other = FactoryBot.create(:user)
      other.generate_login_token!

      post("/api/login_verify", params: { email: other.email, code: other.login_token }, as: :json)

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)).not_to(have_key("deletion_cancelled"))
    end

    it "does not restore a link that was already inactive before the request" do
      earlier = user.shortlinks.create!(original_url: "https://example.com/old", inactive_at: 2.days.ago)
      delete_account
      user.reload.generate_login_token!

      post("/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json)

      expect(earlier.reload.inactive_at).not_to(be_nil)
    end

    it "does not let an account the admin deactivated sign in, even after asking to delete it" do
      delete_account
      user.reload.deactivate!
      user.generate_login_token!

      post("/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json)

      expect(response).to(have_http_status(:forbidden))
      expect(user.reload.deactivated_at).not_to(be_nil)
    end

    it "sends the sign-in code to an account pending deletion, so it can be restored" do
      delete_account
      expect { post("/api/login_request", params: { email: user.email }, as: :json) }.to(have_enqueued_mail(LoginMailer, :magic_link))
    end
  end

  describe PurgeDeletedAccountsJob do
    let(:other) { FactoryBot.create(:user) }

    def build_footprint(owner)
      shortlink = owner.shortlinks.create!(original_url: "https://example.com/p")
      Event.create!(shortlink: shortlink, ip_address: "198.51.100.1", clicked_at: Time.current)
      gone = owner.shortlinks.create!(original_url: "https://example.com/gone")
      gone.soft_delete!
      page = Page.create!(user: owner, slug: "p#{SecureRandom.hex(4)}", display_title: "T")
      page.page_links.create!(label: "L", url: "https://example.com", kind: "link", position: 0)
      Page.create!(user: owner, slug: "d#{SecureRandom.hex(4)}", display_title: "D").soft_delete!
      form = Form.create!(user: owner, title: "F", published: true, fields: [{ "id" => "photo001", "type" => "image", "label" => "P" }])
      upload = form.uploads.create!(field_id: "photo001")
      upload.file.attach(io: StringIO.new("webp"), filename: "image.webp", content_type: "image/webp")
      response = FormResponse.create!(form: form, answers: { "photo001" => upload.token })
      upload.update!(response: response)
      owner.identities.create!(provider: "google", uid: SecureRandom.hex(4))
      owner.update!(email: "changed-#{SecureRandom.hex(3)}@example.com")
    end

    it "deletes everything of accounts past the grace period and nothing of the others" do
      build_footprint(user)
      build_footprint(other)
      delete_account
      mine = { "Shortlink" => Shortlink.with_deleted.where(user_id: user.id).pluck(:id), "Page" => Page.with_deleted.where(user_id: user.id).pluck(:id), "Form" => user.forms.pluck(:id) }
      theirs = Audited::Audit.where(auditable_type: "Shortlink", auditable_id: other.shortlinks.pluck(:id)).count
      expect(Audited::Audit.where(auditable_type: "Shortlink", auditable_id: mine["Shortlink"]).count).to(be > 0)

      travel_to(31.days.from_now) { perform_enqueued_jobs { described_class.perform_now } }

      mine.each { |type, ids| expect(Audited::Audit.where(auditable_type: type, auditable_id: ids)).to(be_empty, type) }
      expect(Audited::Audit.where(auditable_type: "Shortlink", auditable_id: other.shortlinks.pluck(:id)).count).to(eq(theirs))

      expect(User.exists?(user.id)).to(be(false))
      expect(Shortlink.with_deleted.where(user_id: user.id)).to(be_empty)
      expect(Page.with_deleted.where(user_id: user.id)).to(be_empty)
      expect(Form.where(user_id: user.id)).to(be_empty)
      expect(Event.joins(:shortlink).where(shortlinks: { user_id: user.id })).to(be_empty)
      expect(Audited::Audit.where(auditable_type: "User", auditable_id: user.id)).to(be_empty)
      expect(FormUpload.count).to(eq(1))
      expect(ActiveStorage::Attachment.where(record_type: "FormUpload").count).to(eq(1))
      expect(User.exists?(other.id)).to(be(true))
      expect(other.shortlinks.count).to(eq(1))
    end

    it "waits out the 30 days and leaves banned and ordinary accounts alone" do
      delete_account
      banned = FactoryBot.create(:user).tap(&:deactivate!)

      travel_to(29.days.from_now) { described_class.perform_now }
      expect(User.exists?(user.id)).to(be(true))

      travel_to(31.days.from_now) { described_class.perform_now }
      expect(User.exists?(user.id)).to(be(false))
      expect(User.exists?(banned.id)).to(be(true))
    end
  end
end
