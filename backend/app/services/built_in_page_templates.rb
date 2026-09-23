# Ready-made page layouts. Their links are placeholders: they are created
# hidden (active: false) so nothing fake goes live until the owner fills
# them in and switches them on, or deletes them.
module BuiltInPageTemplates
  extend self

  PLACEHOLDER = "https://example.com/replace-me"

  def self.social(icon, url)
    { "kind" => "social", "label" => icon.capitalize, "url" => url, "icon" => icon, "active" => false }
  end

  def self.link(label, icon: nil, url: PLACEHOLDER)
    { "kind" => "link", "label" => label, "url" => url, "icon" => icon, "active" => false }
  end

  def self.header(label)
    { "kind" => "header", "label" => label, "url" => nil, "icon" => nil, "active" => true }
  end

  TEMPLATES = [
    {
      "id" => "creator",
      "name" => "Creator",
      "description" => "Socials on top, your latest content and a way to reach you.",
      "theme" => "sunset",
      "items" => [
        social("instagram", "https://www.instagram.com/your_handle"),
        social("tiktok", "https://www.tiktok.com/@your_handle"),
        social("youtube", "https://www.youtube.com/@your_handle"),
        link("Watch my latest video", icon: "youtube", url: "https://www.youtube.com/@your_handle"),
        link("Shop my merch"),
        header("Work with me"),
        link("Media kit"),
        link("Email me for collabs"),
      ],
    },
    {
      "id" => "business",
      "name" => "Small business",
      "description" => "Catalog, orders on WhatsApp and where to find you.",
      "theme" => "paper",
      "items" => [
        social("instagram", "https://www.instagram.com/your_shop"),
        social("whatsapp", "https://wa.me/351900000000"),
        header("Shop"),
        link("See the catalog"),
        link("Order on WhatsApp", icon: "whatsapp", url: "https://wa.me/351900000000"),
        header("Visit us"),
        link("Opening hours"),
        link("Directions"),
      ],
    },
    {
      "id" => "professional",
      "name" => "Professional",
      "description" => "Portfolio, resume and a link to book a call.",
      "theme" => "midnight",
      "items" => [
        social("linkedin", "https://www.linkedin.com/in/your_profile"),
        social("x", "https://x.com/your_handle"),
        link("Portfolio"),
        link("Resume (PDF)"),
        link("Book a call"),
      ],
    },
    {
      "id" => "musician",
      "name" => "Musician",
      "description" => "Where to listen and where to see you live.",
      "theme" => "ocean",
      "items" => [
        social("instagram", "https://www.instagram.com/your_band"),
        social("youtube", "https://www.youtube.com/@your_band"),
        social("tiktok", "https://www.tiktok.com/@your_band"),
        header("Listen"),
        link("Spotify"),
        link("Apple Music"),
        header("Live"),
        link("Tour dates"),
        link("Tickets"),
      ],
    },
    {
      "id" => "sponsors",
      "name" => "Sponsors",
      "description" => "Sponsor deals with coupons, then things you recommend.",
      "theme" => "default",
      "items" => [
        social("instagram", "https://www.instagram.com/your_handle"),
        social("youtube", "https://www.youtube.com/@your_handle"),
        social("linkedin", "https://www.linkedin.com/in/your_profile"),
        header("Sponsors"),
        link("Sponsor one (coupon: YOURCODE)"),
        link("Sponsor two (coupon: YOURCODE)"),
        link("Sponsor three"),
        header("Things I recommend"),
        link("Books I recommend"),
        link("My course"),
      ],
    },
    {
      "id" => "blank",
      "name" => "Blank",
      "description" => "Start from an empty page.",
      "theme" => "default",
      "items" => [],
    },
  ].freeze

  def all
    TEMPLATES
  end

  def find(id)
    TEMPLATES.find { |template| template["id"] == id }
  end
end
