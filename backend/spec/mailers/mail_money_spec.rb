require "rails_helper"

RSpec.describe(MailerHelper) do
  let(:helper) { Class.new { include MailerHelper }.new }
  let(:nbsp) { " " }

  it "writes euros after the number with a symbol in Portuguese" do
    I18n.with_locale("pt-PT") do
      expect(helper.mail_money(80, "EUR")).to(eq("80,00#{nbsp}€"))
      expect(helper.mail_money(1250.5, "EUR")).to(eq("1#{nbsp}250,50#{nbsp}€"))
    end
  end

  it "writes the symbol first in English" do
    I18n.with_locale("en") do
      expect(helper.mail_money(80, "EUR")).to(eq("€80.00"))
      expect(helper.mail_money(1250.5, "USD")).to(eq("$1,250.50"))
      expect(helper.mail_money(12, "BRL")).to(eq("R$12.00"))
    end
  end

  it "keeps the code after the number when the currency has no symbol here" do
    I18n.with_locale("en") { expect(helper.mail_money(80, "CHF")).to(eq("80.00#{nbsp}CHF")) }
    I18n.with_locale("pt-PT") { expect(helper.mail_money(80, "CHF")).to(eq("80,00#{nbsp}CHF")) }
  end

  it "adds the free sessions after the price" do
    I18n.with_locale("pt-PT") { expect(helper.mail_total(80, "EUR", 1)).to(eq("80,00#{nbsp}€ · 1 sessão grátis")) }
    I18n.with_locale("en") { expect(helper.mail_total(100, "EUR", 2)).to(eq("€100.00 · 2 free sessions")) }
  end
end
