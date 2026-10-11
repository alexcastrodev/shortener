require "rails_helper"

RSpec.describe(Appointments::Resource) do
  it "is the service itself unless the service names a resource" do
    expect(described_class.key({ "id" => "math" })).to(eq("math"))
    expect(described_class.key({ "id" => "math", "resource_key" => "main" })).to(eq("main"))
  end
end
