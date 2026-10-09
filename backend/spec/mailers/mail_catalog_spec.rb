require "rails_helper"

RSpec.describe("Every email, in both languages") do
  include MailCatalog

  CATALOG_MONDAY = { "pt-PT" => "segunda-feira, 12 de outubro · 09:00–09:30", "en" => "Monday 12 October · 09:00–09:30" }.freeze
  CATALOG_EXPECTED = {
    "appointment_mailer/confirmed" => { status: ["Confirmada", "Confirmed"], button: %r{/m/[\w-]{40,}\z}, when: CATALOG_MONDAY, subject: ["Confirmada: ", "Confirmed: "] },
    "appointment_mailer/reminder" => { status: ["Lembrete", "Reminder"], button: %r{/m/[\w-]{40,}\z}, when: CATALOG_MONDAY, subject: ["Lembrete: ", "Reminder: "] },
    "appointment_mailer/new_booking" => { status: ["Nova marcação", "New booking"], button: %r{/app/forms/\d+/responses\z}, when: CATALOG_MONDAY, subject: ["Nova marcação: ", "New booking: "] },
    "appointment_mailer/request_received" => { status: ["Por aprovar", "Awaiting approval"], button: %r{/m/[\w-]{40,}\z}, when: CATALOG_MONDAY, subject: ["Pedido recebido: ", "Request received: "] },
    "appointment_mailer/new_request" => { status: ["Por aprovar", "Awaiting approval"], button: %r{/a/[\w-]{40,}\z}, when: CATALOG_MONDAY, subject: ["Marcação por aprovar: ", "Booking to approve: "] },
    "appointment_mailer/declined" => { status: ["Recusada", "Declined"], button: %r{/f/\w+\z}, when: { "pt-PT" => "segunda-feira, 12 de outubro · 10:00–10:30", "en" => "Monday 12 October · 10:00–10:30" }, subject: ["Não confirmada: ", "Not confirmed: "] },
    "appointment_mailer/verify" => { status: ["Por confirmar", "To confirm"], button: %r{/v/[\w-]{40,}\z}, when: { "pt-PT" => "terça-feira, 13 de outubro · 09:00–09:30", "en" => "Tuesday 13 October · 09:00–09:30" }, subject: ["Confirme a sua marcação: ", "Confirm your booking: "] },
    "appointment_mailer/cancelled" => { status: ["Cancelada", "Cancelled"], button: %r{/f/\w+\z}, when: { "pt-PT" => "quarta-feira, 14 de outubro · 09:00–09:30", "en" => "Wednesday 14 October · 09:00–09:30" }, subject: ["Cancelada: ", "Cancelled: "] },
    "appointment_mailer/owner_cancelled" => { status: ["Cancelada", "Cancelled"], button: %r{/app/forms/\d+/responses\z}, when: { "pt-PT" => "quarta-feira, 14 de outubro · 09:00–09:30", "en" => "Wednesday 14 October · 09:00–09:30" }, subject: ["Marcação cancelada: ", "Booking cancelled: "] },
    "appointment_mailer/rescheduled" => { status: ["Novo horário", "New time"], button: %r{/m/[\w-]{40,}\z}, when: { "pt-PT" => "quinta-feira, 15 de outubro · 15:00–15:30", "en" => "Thursday 15 October · 15:00–15:30" }, subject: ["Horário alterado: ", "Time changed: "] },
    "waitlist_mailer/joined" => { status: ["Lista de espera", "Waiting list"], when: CATALOG_MONDAY, subject: ["Está na lista de espera: ", "You are on the waiting list: "] },
    "waitlist_mailer/offered" => { status: ["Lugar disponível", "Place available"], button: %r{/w/\S{40,}\z}, when: CATALOG_MONDAY, subject: ["Abriu um lugar: ", "A place opened: "] },
    "login_mailer/magic_link" => { subject: [" é o seu código de acesso ao Kurz", " is your Kurz sign-in code"] },
    "account_mailer/data_export" => { subject: ["Os seus dados do Kurz", "Your Kurz data"] },
    "account_mailer/data_export_too_large" => { subject: ["Os seus dados do Kurz são demasiado grandes para enviar", "Your Kurz data is too large to send"] },
    "account_mailer/deletion_scheduled" => { status: ["Eliminação marcada", "Deletion scheduled"], button: %r{/login\z}, when: { "pt-PT" => "8 de novembro de 2026", "en" => "8 November 2026" }, subject: ["A sua conta Kurz está marcada para eliminação", "Your Kurz account is scheduled for deletion"] },
  }.freeze
  CATALOG_BUTTON = /<td class="button" bgcolor="#116d6e"[^>]*>\s*<a href="([^"]+)"/

  around do |example|
    previous = ENV.values_at("GMAIL_USERNAME", "FRONTEND_URL")
    fallbacks = I18n.fallbacks
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    ENV["FRONTEND_URL"] = "https://kurz.test"
    I18n.fallbacks = I18n::Locale::Fallbacks.new
    travel_to(Time.utc(2026, 10, 9, 10, 0)) { example.run }
  ensure
    ENV["GMAIL_USERNAME"], ENV["FRONTEND_URL"] = previous
    I18n.fallbacks = fallbacks
  end

  it "covers every mailer action" do
    actions = [AppointmentMailer, WaitlistMailer, LoginMailer, AccountMailer].flat_map { |mailer| mailer.action_methods.map { |action| "#{mailer.name.underscore}/#{action}" } }

    expect(CATALOG_EXPECTED.keys).to(match_array(actions))
  end

  ["pt-PT", "en"].each_with_index do |locale, index|
    CATALOG_EXPECTED.each do |name, expected|
      describe "#{name} in #{locale}" do
        subject(:mail) { catalog_mails(locale).fetch(name).call }

        let(:html) { mail.html_part.body.decoded }
        let(:text) { mail.text_part.body.decoded }

        it "has an HTML and a text part in that language, with nothing left untranslated" do
          expect(html).to(include(%(<html lang="#{locale}">)))
          expect(html.scan(/<html/i).size).to(eq(1))
          [html, text, mail.subject].each { |part| expect(part).not_to(match(/translation[ _]missing/i)) }
          expect(mail.subject).to(include(expected[:subject][index]))
        end

        it "names what happened in the status pill" do
          pill = html[%r{<span class="tone-\w+"[^>]*>([^<]+)</span>}, 1]

          expect(pill).to(eq(expected[:status]&.at(index)))
        end

        it "has one button, and its link on a line of its own in the text" do
          url = html[CATALOG_BUTTON, 1]

          if expected[:button]
            expect(html.scan(CATALOG_BUTTON).size).to(eq(1))
            expect(url).to(start_with("https://kurz.test/").and(match(expected[:button])))
            expect(text.lines.map(&:strip)).to(include(url))
          else
            expect(url).to(be_nil)
          end
        end

        if expected[:when]
          it "writes dates in the reader's language, 24-hour clock, in the booking's time zone" do
            expect(html.gsub(/<[^>]+>/, "")).to(include(expected[:when][locale]))
            expect(text).to(include(expected[:when][locale]))
            expect(text).not_to(match(/\d\s?[AP]M\b/i))
          end
        end

        it "escapes what owners and clients wrote" do
          expect(html).not_to(match(/<(b|i|u|Ana)>/))
          expect(html).to(include("Massagem &lt;b&gt;relax&lt;/b&gt;")) if name.start_with?("appointment", "waitlist")
          expect(text).to(include(MailCatalog::SERVICE)) if name.start_with?("appointment", "waitlist")
          expect(mail.subject).not_to(match(/[\r\n]/))
        end

        it "keeps every link of the text part on its own line" do
          text.scan(%r{https?://\S+}).each { |url| expect(text.lines.map(&:strip)).to(include(url)) }
        end
      end
    end
  end

  it "shows the client's own words in the details, not as markup" do
    mail = catalog_mails("pt-PT").fetch("appointment_mailer/rescheduled").call

    expect(mail.text_part.body.decoded).to(include("Antes: quinta-feira, 15 de outubro · 09:00–09:30", "Mensagem de Estúdio <Ana> & Co: Mudei <u>para a tarde</u>"))
    expect(mail.html_part.body.decoded).to(include("Mudei &lt;u&gt;para a tarde&lt;/u&gt;"))
  end

  it "lists many sessions under their count and adds the total with the free sessions" do
    text = catalog_mails("pt-PT").fetch("appointment_mailer/confirmed").call.text_part.body.decoded

    expect(text).to(include("3 sessões:\n- segunda-feira, 12 de outubro · 09:00–09:30\n- quarta-feira, 14 de outubro · 15:00–15:30\n- sexta-feira, 16 de outubro · 09:00–09:30\n  Fuso horário: Europe/Lisbon"))
    expect(text).to(include("Total: 80,00 EUR · 1 sessão grátis"))
  end

  it "puts a short localized date in the subject" do
    expect(catalog_mails("pt-PT").fetch("appointment_mailer/confirmed").call.subject).to(eq("Confirmada: Massagem <b>relax</b> · seg, 12 out, 09:00"))
    expect(catalog_mails("en").fetch("appointment_mailer/confirmed").call.subject).to(eq("Confirmed: Massagem <b>relax</b> · Mon 12 Oct, 09:00"))
  end
end
