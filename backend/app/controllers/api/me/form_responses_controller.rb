class Api::Me::FormResponsesController < ApplicationController
  include FormLookup

  MAX_LIMIT = 50

  before_action :authenticate_user!, prepend: true

  def index
    limit = params[:limit].to_i.clamp(1, MAX_LIMIT)
    limit = MAX_LIMIT unless params[:limit].present?
    scope = @form.responses.order(id: :desc)
    scope = scope.where(created_at: (params[:days].to_i - 1).days.ago.utc.beginning_of_day..) if Forms::Summary::PERIODS.include?(params[:days].to_i)
    scope = scope.where(id: ...params[:before].to_i) if params[:before].present?
    rows = scope.limit(limit + 1).to_a
    more = rows.size > limit
    rows = rows.first(limit)

    render(
      json: {
        response: JSON.parse(FormResponseSerializer.new(rows, params: { fields: @form.fields }).serialize)["response"],
        next_before: more ? rows.last.id : nil,
      },
      status: :ok,
    )
  end

  def show
    response = @form.responses.find(params[:id])
    render(json: FormResponseSerializer.new(response, params: { fields: @form.fields }).serialize, status: :ok)
  end

  def destroy
    @form.responses.find(params[:id]).destroy!
    head(:no_content)
  end

  def destroy_all
    @form.responses.delete_all
    @form.update_column(:responses_count, 0)
    head(:no_content)
  end

  def summary
    render(json: Forms::Summary.call(form: @form, days: params[:days]), status: :ok)
  end
end
