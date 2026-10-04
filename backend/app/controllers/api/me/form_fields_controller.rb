class Api::Me::FormFieldsController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true

  def create
    validate_contract(FormFieldContract) do |validated_params|
      render(json: FormSerializer.new(Forms::Definition.add(@form, validated_params)).serialize, status: :created)
    rescue ActiveRecord::RecordInvalid => e
      render_invalid(e)
    end
  end

  def update
    validate_contract(FormFieldUpdateContract) do |validated_params|
      render(json: FormSerializer.new(Forms::Definition.update(@form, params[:id], validated_params)).serialize, status: :ok)
    rescue ActiveRecord::RecordInvalid => e
      render_invalid(e)
    end
  end

  def destroy
    render(json: FormSerializer.new(Forms::Definition.remove(@form, params[:id])).serialize, status: :ok)
  end

  def reorder
    validate_contract(FormFieldReorderContract) do |validated_params|
      render(json: FormSerializer.new(Forms::Definition.reorder(@form, validated_params[:ids])).serialize, status: :ok)
    rescue ActiveRecord::RecordInvalid => e
      render_invalid(e)
    end
  end

  private

  def render_invalid(error)
    render(json: { errors: error.record.errors.to_hash }, status: :unprocessable_entity)
  end
end
