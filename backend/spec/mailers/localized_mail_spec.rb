require "rails_helper"

RSpec.describe("Localized email") do
  let(:user) { User.create!(email: "reader@example.com").tap(&:generate_login_token!) }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  def login_mail(**params)
    LoginMailer.with(user: user, **params).magic_link
  end

  describe LoginMailer do
    {
      "sign_in" => "é o seu código de acesso ao Kurz",
      "sign_up" => "é o seu código de confirmação do Kurz",
      "sign_up_existing" => "é o seu código de confirmação do Kurz",
      "password_reset" => "é o seu código para repor a palavra-passe do Kurz",
    }.each do |purpose, subject|
      it "words the #{purpose} code in European Portuguese" do
        mail = login_mail(purpose: purpose, locale: "pt-PT")

        expect(mail.subject).to(eq("#{user.login_token} #{subject}"))
        expect(mail.text_part.body.decoded).to(include("expira em 15 minutos"))
        expect(mail.html_part.body.decoded).to(include('<html lang="pt-PT">', user.login_token))
      end
    end

    it "uses the language of the request before the saved preference" do
      user.update!(locale: "pt-PT")

      expect(login_mail(locale: "en").subject).to(end_with("is your Kurz sign-in code"))
    end

    it "uses the saved preference when the request names no language" do
      user.update!(locale: "pt-PT")

      expect(login_mail.subject).to(end_with("é o seu código de acesso ao Kurz"))
    end

    it "falls back to English for a language that is not supported" do
      mail = login_mail(locale: "fr")

      expect(mail.subject).to(end_with("is your Kurz sign-in code"))
      expect(mail.html_part.body.decoded).to(include('<html lang="en">'))
    end

    it "leaves the language of the process alone" do
      login_mail(locale: "pt-PT").subject

      expect(I18n.locale).to(eq(:en))
    end
  end

  describe AccountMailer do
    before { user.update!(deletion_requested_at: Time.current) }

    it "tells a Portuguese speaker in Portuguese" do
      user.update!(locale: "pt-PT")
      mail = described_class.with(user: user).deletion_scheduled

      expect(mail.subject).to(eq("A sua conta Kurz está marcada para eliminação"))
      expect(mail.body.decoded).to(include("Pediu para eliminar a conta Kurz reader@example.com", user.deletion_due_at.to_date.iso8601))
    end

    it "stays in English without a preference" do
      mail = described_class.with(user: user).deletion_scheduled

      expect(mail.subject).to(eq("Your Kurz account is scheduled for deletion"))
    end
  end

  describe "locale files" do
    def flatten(tree, prefix = nil)
      tree.flat_map do |key, value|
        path = [prefix, key].compact.join(".")
        value.is_a?(Hash) ? flatten(value, path).to_a : [[path, value]]
      end.to_h
    end

    let(:english) { flatten(YAML.load_file(Rails.root.join("config/locales/en.yml"))["en"]) }
    let(:portuguese) { flatten(YAML.load_file(Rails.root.join("config/locales/pt-PT.yml"))["pt-PT"]) }

    def variables(text) = text.scan(/%\{(\w+)\}/).flatten.sort

    it "declares only languages the User model accepts" do
      expect(I18n.available_locales.map(&:to_s)).to(eq(User::LOCALES))
    end

    it "translates every key of the namespaces it covers, with the same variables" do
      namespaces = portuguese.keys.map { |key| key.split(".").first }.uniq
      expected = english.select { |key, _| namespaces.include?(key.split(".").first) }

      expect(portuguese.keys.sort).to(eq(expected.keys.sort))
      expected.each { |key, text| expect(variables(portuguese[key])).to(eq(variables(text)), "variables differ in #{key}") }
    end
  end
end
