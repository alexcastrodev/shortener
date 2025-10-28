class Api::ShortlinksController < ApplicationController
  before_action :authenticate_user, only: [:create]

  # POST /api/shortlinks
  def create
    validate_contract(ShortlinkContract) do |validated_params|
      existent_user = User.find_by(email: validated_params[:email]) if validated_params.key?(:email)
      if existent_user && existent_user.shortlinks.count > 0
        render(json: { error: I18n.t("errors.guest_email_with_shortlinks") }, status: :forbidden)
        return
      end

      link = Shortlink.new(validated_params.merge({ created_by_guest: @current_user.blank?, user: @current_user }))

      if link.save
        render(json: PublicShortlinkSerializer.new(link).serialize, status: :created)
      else
        render(json: { error: I18n.t("errors.form_error"), errors: link.errors.full_messages }, status: :unprocessable_content)
      end
    end
  end
end
