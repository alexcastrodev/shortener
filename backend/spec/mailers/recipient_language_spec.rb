require "rails_helper"

RSpec.describe("The language an email is written in") do
  include MailCatalog

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    travel_to(Time.utc(2026, 10, 9, 10, 0)) { example.run }
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  describe "ApplicationMailer.recipient_locale" do
    let(:portuguese) { User.new(locale: "pt-PT") }
    let(:english) { User.new(locale: "en") }
    let(:unset) { User.new(locale: nil) }

    it "takes the language of this interaction first" do
      expect(ApplicationMailer.recipient_locale("en", portuguese, portuguese)).to(eq("en"))
    end

    it "then the recipient's saved language" do
      expect(ApplicationMailer.recipient_locale(nil, portuguese, english)).to(eq("pt-PT"))
    end

    it "then, for a recipient without one, the form owner's saved language" do
      expect(ApplicationMailer.recipient_locale(nil, nil, portuguese)).to(eq("pt-PT"))
      expect(ApplicationMailer.recipient_locale(nil, unset, portuguese)).to(eq("pt-PT"))
    end

    it "then English" do
      expect(ApplicationMailer.recipient_locale(nil, unset, unset)).to(eq("en"))
      expect(ApplicationMailer.recipient_locale(nil)).to(eq("en"))
    end

    it "skips languages Kurz does not speak" do
      expect(ApplicationMailer.recipient_locale("fr", User.new(locale: "pt-BR"), portuguese)).to(eq("pt-PT"))
    end
  end

  describe "for a visitor" do
    let(:mails) { catalog_mails("pt-PT") }

    def subject_of(name) = mails.fetch(name).call.subject

    it "follows the page they booked from, even when the owner reads another language" do
      mails
      User.where(email: "owner-pt-pt@example.com").update_all(locale: "en")

      expect(subject_of("appointment_mailer/confirmed")).to(start_with("Confirmada:"))
    end

    it "falls back to the owner's language when the booking names none (an API or MCP booking)" do
      mails
      Appointment.update_all(client_locale: nil)
      WaitlistEntry.update_all(locale: nil)

      expect(subject_of("appointment_mailer/confirmed")).to(start_with("Confirmada:"))
      expect(subject_of("appointment_mailer/cancelled")).to(start_with("Cancelada:"))
      expect(subject_of("waitlist_mailer/joined")).to(start_with("Está na lista de espera:"))
    end

    it "prefers the language saved on the visitor's own Kurz account over the owner's" do
      mails
      Appointment.update_all(client_locale: nil)
      User.create!(email: "rita@example.com", locale: "en", verified_at: Time.current)

      expect(subject_of("appointment_mailer/confirmed")).to(start_with("Confirmed:"))
    end

    it "is English when neither the booking nor the owner name a language" do
      mails
      Appointment.update_all(client_locale: nil)
      User.where(email: "owner-pt-pt@example.com").update_all(locale: nil)

      expect(subject_of("appointment_mailer/confirmed")).to(start_with("Confirmed:"))
    end
  end

  describe "for the owner" do
    let(:mails) { catalog_mails("pt-PT") }

    it "uses the owner's saved language, never the client's" do
      mails
      User.where(email: "owner-pt-pt@example.com").update_all(locale: "en")

      expect(mails.fetch("appointment_mailer/new_booking").call.subject).to(start_with("New booking:"))
    end

    it "is English for an owner who never saved a language" do
      mails
      User.where(email: "owner-pt-pt@example.com").update_all(locale: nil)

      expect(mails.fetch("appointment_mailer/new_booking").call.subject).to(start_with("New booking:"))
      expect(mails.fetch("appointment_mailer/new_request").call.subject).to(start_with("Booking to approve:"))
    end
  end

  it "leaves the language of the process alone" do
    catalog_mails("pt-PT").fetch("appointment_mailer/confirmed").call

    expect(I18n.locale).to(eq(:en))
  end
end
