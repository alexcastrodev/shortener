require "rails_helper"

RSpec.describe(Forms::Create) do
  let(:user) { FactoryBot.create(:user) }

  it "creates an unpublished form for the user" do
    form = described_class.call(user: user, attributes: { title: "Contact" })

    expect(form).to(be_persisted)
    expect(form.user).to(eq(user))
    expect(form.published).to(be(false))
  end

  it "raises RecordInvalid for an invalid form without counting it" do
    expect { described_class.call(user: user, attributes: { title: "" }) }.to(raise_error(ActiveRecord::RecordInvalid))
    expect(user.forms.count).to(eq(0))
  end

  it "allows exactly #{Form::MAX_CREATED_PER_DAY} forms per 24 hours" do
    Form::MAX_CREATED_PER_DAY.times { |i| described_class.call(user: user, attributes: { title: "F#{i}" }) }

    expect { described_class.call(user: user, attributes: { title: "one more" }) }.to(raise_error(Forms::LimitReached))
    expect(user.forms.count).to(eq(Form::MAX_CREATED_PER_DAY))
  end

  it "counts per user" do
    other = FactoryBot.create(:user)
    Form::MAX_CREATED_PER_DAY.times { |i| described_class.call(user: user, attributes: { title: "F#{i}" }) }

    expect(described_class.call(user: other, attributes: { title: "mine" })).to(be_persisted)
  end

  it "forgets forms older than 24 hours" do
    Form::MAX_CREATED_PER_DAY.times { |i| user.forms.create!(title: "old#{i}", created_at: 25.hours.ago) }

    expect(described_class.call(user: user, attributes: { title: "new" })).to(be_persisted)
  end

  it "never goes past the limit under concurrent requests" do
    (Form::MAX_CREATED_PER_DAY - 1).times { |i| user.forms.create!(title: "f#{i}") }
    allow_any_instance_of(described_class).to(receive(:created_today).and_wrap_original do |original|
      count = original.call
      sleep(0.1)
      count
    end)
    results = Array.new(6) do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          described_class.call(user: User.find(user.id), attributes: { title: "race" })
          :created
        rescue Forms::LimitReached
          :limited
        end
      end
    end.map(&:value)

    expect(results.count(:created)).to(eq(1))
    expect(Form.where(user_id: user.id).count).to(eq(Form::MAX_CREATED_PER_DAY))
  end
end
