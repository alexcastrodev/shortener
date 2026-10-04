module BuiltInFormTemplates
  extend self

  def question(type, label, required: false, help: nil, **extra)
    { "type" => type, "label" => label, "required" => required, "help" => help }.compact.merge(extra.transform_keys(&:to_s))
  end

  def options(*labels)
    labels.map { |label| { "label" => label } }
  end

  TEMPLATES = [
    {
      "id" => "contact",
      "name" => "Contact",
      "description" => "Name, e-mail and a message.",
      "theme" => "default",
      "title" => "Get in touch",
      "thank_you_message" => "Thanks for reaching out. We will get back to you soon.",
      "fields" => [
        question("short_text", "Your name", required: true),
        question("email", "Your e-mail", required: true),
        question("long_text", "How can we help?", required: true),
      ],
    },
    {
      "id" => "feedback",
      "name" => "Feedback",
      "description" => "A rating and what could be better.",
      "theme" => "ocean",
      "title" => "Tell us what you think",
      "thank_you_message" => "Thank you for your feedback.",
      "fields" => [
        question("rating", "How would you rate your experience?", required: true, scale: 5),
        question("long_text", "What could we do better?"),
        question("email", "Your e-mail", help: "Only if you want a reply."),
      ],
    },
    {
      "id" => "event_rsvp",
      "name" => "Event RSVP",
      "description" => "Who is coming and what they need.",
      "theme" => "sunset",
      "title" => "Will you join us?",
      "thank_you_message" => "Your answer was recorded. See you there!",
      "fields" => [
        question("short_text", "Your name", required: true),
        question("yes_no", "Will you attend?", required: true),
        question("number", "How many people are coming?", min: 1, max: 20),
        question("multiple_choice", "Dietary needs", choices: options("Vegetarian", "Vegan", "Gluten free", "None")),
      ],
    },
    {
      "id" => "satisfaction",
      "name" => "Satisfaction survey",
      "description" => "Score, reason and recommendation.",
      "theme" => "forest",
      "title" => "How did we do?",
      "thank_you_message" => "Thanks for taking the time to answer.",
      "fields" => [
        question("rating", "How satisfied are you?", required: true, scale: 10),
        question("single_choice", "What matters most to you?", choices: options("Quality", "Price", "Support", "Speed")),
        question("yes_no", "Would you recommend us?", required: true),
        question("long_text", "Anything else you want to tell us?"),
      ],
    },
    {
      "id" => "bug_report",
      "name" => "Bug report",
      "description" => "What happened, how to reproduce it and how bad it is.",
      "theme" => "midnight",
      "title" => "Report a problem",
      "thank_you_message" => "Thanks, the report was received.",
      "fields" => [
        question("short_text", "What went wrong?", required: true),
        question("long_text", "Steps to reproduce", required: true),
        question("single_choice", "How severe is it?", required: true, choices: options("Minor", "Annoying", "Blocks my work")),
        question("email", "Your e-mail", help: "So we can follow up."),
      ],
    },
    {
      "id" => "waitlist",
      "name" => "Waitlist",
      "description" => "Collect e-mails before launch.",
      "theme" => "paper",
      "title" => "Join the waitlist",
      "thank_you_message" => "You are on the list. We will write when it is ready.",
      "fields" => [
        question("email", "Your e-mail", required: true),
        question("short_text", "Your name"),
        question("single_choice", "How did you hear about us?", choices: options("Friend", "Social media", "Search", "Other")),
      ],
    },
  ].freeze

  def all
    TEMPLATES
  end

  def find(id)
    TEMPLATES.find { |template| template["id"] == id }
  end

  def build(id)
    template = find(id) || return
    {
      "title" => template["title"],
      "theme" => template["theme"],
      "thank_you_message" => template["thank_you_message"],
      "fields" => template["fields"].map { |field| with_ids(field) },
    }
  end

  private

  def with_ids(field)
    field = field.merge("id" => new_id)
    field["choices"] = field["choices"].map { |choice| choice.merge("id" => new_id) } if field["choices"]
    field
  end

  def new_id
    SecureRandom.alphanumeric(Forms::FieldSchema::ID_LENGTH)
  end
end
