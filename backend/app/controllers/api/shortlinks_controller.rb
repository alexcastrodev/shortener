class Api::ShortlinksController < ApplicationController
  before_action :authenticate_user, only: [:create]

  # POST /api/shortlinks
  def create
    validate_contract(ShortlinkContract) do |validated_params|
      link = Shortlink.new(validated_params.merge({ created_by_guest: @current_user.blank?, user: @current_user }))

      if link.save
        render(json: PublicShortlinkSerializer.new(link).serialize, status: :created)
      else
        render(json: { errors: link.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end
end
