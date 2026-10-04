class Api::Me::FormsController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true
  skip_before_action :load_form, only: [:index, :create]

  def index
    forms = policy_scope(Form).order(created_at: :desc)
    render(json: FormSerializer.new(forms).serialize, status: :ok)
  end

  def show
    render(json: FormSerializer.new(@form).serialize, status: :ok)
  end

  def create
    validate_contract(FormContract) do |validated_params|
      attributes = attributes_for(validated_params)
      return render(json: { errors: { template: ["is unknown"] } }, status: :unprocessable_entity) unless attributes

      form = Forms::Create.call(user: @current_user, attributes: attributes)
      render(json: FormSerializer.new(form).serialize, status: :created)
    rescue Forms::LimitReached
      render(json: { error: "forms_daily_limit" }, status: :too_many_requests)
    rescue ActiveRecord::RecordInvalid => e
      render(json: { errors: e.record.errors.to_hash }, status: :unprocessable_entity)
    end
  end

  def update
    validate_contract(FormUpdateContract) do |validated_params|
      if @form.update(validated_params)
        render(json: FormSerializer.new(@form).serialize, status: :ok)
      else
        render(json: { errors: @form.errors.to_hash }, status: :unprocessable_entity)
      end
    end
  end

  def destroy
    @form.destroy!
    head(:no_content)
  end

  def publish
    return render(json: { errors: { fields: ["must have at least one question to publish"] } }, status: :unprocessable_entity) if @form.fields.empty?

    @form.update!(published: true)
    render(json: FormSerializer.new(@form).serialize, status: :ok)
  end

  def unpublish
    @form.update!(published: false)
    render(json: FormSerializer.new(@form).serialize, status: :ok)
  end

  private

  def attributes_for(validated_params)
    template_id = validated_params.delete(:template)
    return validated_params if template_id.blank?

    built = BuiltInFormTemplates.build(template_id)
    built&.symbolize_keys&.merge(validated_params.compact)
  end
end
