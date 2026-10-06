class Api::Me::FormsController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true
  skip_before_action :load_form, only: [:index, :create]

  rescue_from Forms::LimitReached do
    render(json: { error: "forms_daily_limit" }, status: :too_many_requests)
  end

  SORTS = {
    "edited" => [{ updated_at: :desc, id: :desc }],
    "name" => [Form.arel_table[:title].lower.asc, { id: :asc }],
    "responses" => [{ responses_count: :desc, id: :desc }],
  }.freeze
  SEARCH_MAX = 100

  def index
    owned = policy_scope(Form)
    forms = filtered(owned).includes(:shortlink).order(*SORTS.fetch(params[:sort].to_s, SORTS["edited"]))
    counts = owned.group(:published).count
    meta = {
      total: counts.values.sum,
      live: counts.fetch(true, 0),
      draft: counts.fetch(false, 0),
      responses: owned.sum(:responses_count),
    }
    render(json: JSON.parse(FormSerializer.new(forms).serialize).merge("meta" => meta), status: :ok)
  end

  def show
    render(json: FormSerializer.new(@form).serialize, status: :ok)
  end

  def create
    validate_contract(FormContract) do |validated_params|
      attributes = attributes_for(validated_params)
      return render(json: { errors: { template: ["is unknown"] } }, status: :unprocessable_content) unless attributes

      form = Forms::Create.call(user: @current_user, attributes: attributes)
      render(json: FormSerializer.new(form).serialize, status: :created)
    rescue ActiveRecord::RecordInvalid => e
      render(json: { errors: e.record.errors.to_hash }, status: :unprocessable_content)
    end
  end

  def update
    validate_contract(FormUpdateContract) do |validated_params|
      if @form.update(validated_params)
        render(json: FormSerializer.new(@form).serialize, status: :ok)
      else
        render(json: { errors: @form.errors.to_hash }, status: :unprocessable_content)
      end
    end
  end

  def destroy
    @form.destroy!
    head(:no_content)
  end

  def publish
    render(json: FormSerializer.new(Forms::Publish.call(form: @form)).serialize, status: :ok)
  rescue Forms::Publish::NoQuestions
    render(json: { errors: { fields: ["must have at least one question to publish"] } }, status: :unprocessable_content)
  rescue Forms::Publish::Blocked => e
    render(json: { errors: { fields: e.messages } }, status: :unprocessable_content)
  end

  def apply_template
    validate_contract(FormTemplateApplicationContract) do |validated_params|
      render(json: FormSerializer.new(Forms::Definition.apply_template(@form, validated_params[:template], locale: template_locale(validated_params[:locale]))).serialize, status: :ok)
    rescue ActiveRecord::RecordInvalid => e
      render(json: { errors: e.record.errors.to_hash }, status: :unprocessable_content)
    end
  end

  def duplicate
    copy = Forms::Create.call(user: @current_user, attributes: duplicate_attributes)
    render(json: FormSerializer.new(copy).serialize, status: :created)
  end

  def unpublish
    render(json: FormSerializer.new(Forms::Unpublish.call(form: @form)).serialize, status: :ok)
  end

  def discard
    render(json: FormSerializer.new(Forms::Discard.call(form: @form)).serialize, status: :ok)
  rescue Forms::Discard::NothingPublished
    render(json: { errors: { base: ["nothing has been published yet"] } }, status: :unprocessable_content)
  end

  private

  def template_locale(requested)
    User::LOCALES.include?(requested) ? requested : current_user.locale
  end

  def filtered(scope)
    scope = scope.where(published: params[:status] == "live") if ["live", "draft"].include?(params[:status])
    term = params[:q].to_s.strip.first(SEARCH_MAX)
    term.present? ? scope.where("forms.title ILIKE ?", "%#{Form.sanitize_sql_like(term)}%") : scope
  end

  def duplicate_attributes
    {
      title: "Copy of #{@form.title}".first(Form::TITLE_MAX),
      description: @form.description,
      thank_you_message: @form.thank_you_message,
      theme: @form.theme,
      custom_colors: @form.custom_colors,
      layout: @form.layout,
      fields: @form.fields.map { |field| Forms::FieldSchema.with_fresh_ids(field) },
    }
  end

  def attributes_for(validated_params)
    template_id = validated_params.delete(:template)
    locale = template_locale(validated_params.delete(:locale))
    return validated_params if template_id.blank?

    built = BuiltInFormTemplates.build(template_id, locale: locale)
    built&.symbolize_keys&.merge(validated_params.compact)
  end
end
