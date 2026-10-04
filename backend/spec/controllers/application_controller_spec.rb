require "rails_helper"

RSpec.describe(ApplicationController, type: :controller) do
  controller do
    def index
      raise ActiveRecord::RecordNotUnique, "PG::UniqueViolation DETAIL: Key (email)=(CNRY-secret) already exists."
    end
  end

  it "answers 409 without echoing the database message" do
    get :index
    expect(response).to(have_http_status(:conflict))
    expect(response.body).not_to(include("CNRY-secret"))
  end
end
