module BuiltInFormTemplatesPt
  TEXTS = {
    "contact" => {
      "name" => "Contacto",
      "description" => "Nome, e-mail e uma mensagem.",
      "title" => "Fale connosco",
      "thank_you_message" => "Obrigado por nos contactar. Respondemos em breve.",
      "fields" => [
        { "label" => "O seu nome" },
        { "label" => "O seu e-mail" },
        { "label" => "Em que podemos ajudar?" },
      ],
    },
    "feedback" => {
      "name" => "Opinião",
      "description" => "Uma classificação e o que podia ser melhor.",
      "title" => "Diga-nos o que pensa",
      "thank_you_message" => "Obrigado pela sua opinião.",
      "fields" => [
        { "label" => "Como classifica a sua experiência?" },
        { "label" => "O que podíamos fazer melhor?" },
        { "label" => "O seu e-mail", "help" => "Só se quiser uma resposta." },
      ],
    },
    "event_rsvp" => {
      "name" => "Confirmação de presença",
      "description" => "Quem vem e do que precisa.",
      "title" => "Vem ter connosco?",
      "thank_you_message" => "A sua resposta ficou registada. Até já!",
      "fields" => [
        { "label" => "O seu nome" },
        { "label" => "Vai comparecer?" },
        { "label" => "Quantas pessoas vêm?" },
        { "label" => "Necessidades alimentares", "choices" => ["Vegetariano", "Vegano", "Sem glúten", "Nenhuma"] },
      ],
    },
    "satisfaction" => {
      "name" => "Inquérito de satisfação",
      "description" => "Pontuação, motivo e recomendação.",
      "title" => "Como nos saímos?",
      "thank_you_message" => "Obrigado por dedicar o seu tempo a responder.",
      "fields" => [
        { "label" => "Quão satisfeito está?" },
        { "label" => "O que mais valoriza?", "choices" => ["Qualidade", "Preço", "Apoio", "Rapidez"] },
        { "label" => "Recomendava-nos?" },
        { "label" => "Quer dizer-nos mais alguma coisa?" },
      ],
    },
    "bug_report" => {
      "name" => "Reporte de erro",
      "description" => "O que aconteceu, como reproduzir e quão grave é.",
      "title" => "Reportar um problema",
      "thank_you_message" => "Obrigado, o reporte foi recebido.",
      "fields" => [
        { "label" => "O que correu mal?" },
        { "label" => "Passos para reproduzir" },
        { "label" => "Quão grave é?", "choices" => ["Pequeno", "Incomoda", "Impede o meu trabalho"] },
        { "label" => "Captura de ecrã", "help" => "Opcional. PNG, JPEG, WebP ou HEIC." },
        { "label" => "O seu e-mail", "help" => "Para podermos responder." },
      ],
    },
    "waitlist" => {
      "name" => "Lista de espera",
      "description" => "Recolha e-mails antes do lançamento.",
      "title" => "Entre na lista de espera",
      "thank_you_message" => "Está na lista. Escrevemos quando estiver pronto.",
      "fields" => [
        { "label" => "O seu e-mail" },
        { "label" => "O seu nome" },
        { "label" => "Como soube de nós?", "choices" => ["Amigo", "Redes sociais", "Pesquisa", "Outro"] },
      ],
    },
  }.freeze
end
