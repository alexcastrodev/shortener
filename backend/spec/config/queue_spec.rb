require "rails_helper"

RSpec.describe("config/queue.yml") do
  let(:workers) { Rails.application.config_for(:queue).fetch(:workers) }

  def queues_of(worker)
    Array(worker[:queues])
  end

  it "has a dedicated worker for notifications that no other worker shares" do
    owners = workers.select { |worker| queues_of(worker).include?("notifications") }
    expect(owners.size).to(eq(1))
    expect(queues_of(owners.first)).to(eq(["notifications"]))
  end
end
