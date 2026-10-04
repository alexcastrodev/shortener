module FormLookup
  extend ActiveSupport::Concern

  included do
    before_action :load_form
  end

  private

  def load_form
    @form = policy_scope(Form).find(params[:form_id] || params[:id])
  end
end
