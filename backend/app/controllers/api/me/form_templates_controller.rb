class Api::Me::FormTemplatesController < ApplicationController
  before_action :authenticate_user!

  def index
    templates = BuiltInFormTemplates.all.map do |template|
      template.slice("id", "name", "description", "theme").merge("questions" => template["fields"].size)
    end

    render(json: { form_template: templates }, status: :ok)
  end
end
