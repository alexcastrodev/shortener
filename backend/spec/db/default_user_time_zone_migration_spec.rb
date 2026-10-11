require "rails_helper"
require Rails.root.join("db/migrate/20261012120000_default_user_time_zone_to_lisbon")

RSpec.describe(DefaultUserTimeZoneToLisbon) do
  let(:connection) { ActiveRecord::Base.connection }

  around do |example|
    example.run
  ensure
    connection.change_column_default(:users, :time_zone, "Europe/Lisbon")
    User.reset_column_information
  end

  before do
    connection.change_column_default(:users, :time_zone, from: "Europe/Lisbon", to: "UTC")
    User.reset_column_information
  end

  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  def zone_of(user) = connection.select_value("SELECT time_zone FROM users WHERE id = #{user.id}")

  it "moves the users that were left on the old default to Europe/Lisbon and keeps the ones that chose another zone" do
    left = User.create!(email: "left@example.com")
    chosen = User.create!(email: "chosen@example.com", time_zone: "America/Sao_Paulo")
    expect(zone_of(left)).to(eq("UTC"))

    migrate

    expect(zone_of(left)).to(eq("Europe/Lisbon"))
    expect(zone_of(chosen)).to(eq("America/Sao_Paulo"))
  end

  it "makes Europe/Lisbon the zone of a user created afterwards" do
    migrate
    User.reset_column_information

    expect(User.create!(email: "new@example.com").time_zone).to(eq("Europe/Lisbon"))
  end

  it "can be undone" do
    migrate
    ActiveRecord::Migration.suppress_messages { described_class.new.down }
    User.reset_column_information

    expect(User.create!(email: "back@example.com").time_zone).to(eq("UTC"))
  end
end
