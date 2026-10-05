require "rails_helper"

RSpec.describe(CustomColors) do
  let(:user) { FactoryBot.create(:user) }
  let(:colors) { { "background" => "#112233", "text" => "#FFFFFF", "accent" => "#ff00aa" } }

  it "accepts three hex colors on forms and pages and lowercases them" do
    form = Form.new(user: user, title: "Contact", custom_colors: colors)

    expect(form).to(be_valid)
    expect(form.custom_colors["text"]).to(eq("#ffffff"))
    expect(Page.new(user: user, slug: "colors-page", custom_colors: colors)).to(be_valid)
  end

  it "rejects anything that is not exactly background, text and accent as #RRGGBB" do
    [
      colors.merge("text" => "red"),
      colors.merge("text" => "url(javascript:alert(1))"),
      colors.merge("accent" => "#fff"),
      colors.except("accent"),
      colors.merge("extra" => "#000000"),
    ].each do |invalid|
      expect(Form.new(user: user, title: "Contact", custom_colors: invalid)).not_to(be_valid)
    end
  end

  it "allows no custom colors" do
    expect(Form.new(user: user, title: "Contact", custom_colors: nil)).to(be_valid)
  end
end
