class Api::Me::NotificationPreferencesController < ApplicationController
  before_action :authenticate_user!

  def show
    render(json: { preferences: NotificationPreference.matrix(current_user) }, status: :ok)
  end

  def update
    changes = params[:preferences]
    return render(json: { error: "invalid_preferences" }, status: :unprocessable_entity) unless changes.is_a?(Array) && changes.size <= NotificationPreference::KINDS.size * NotificationPreference::CHANNELS.size

    saved = NotificationPreference.transaction do
      changes.map do |item|
        row = NotificationPreference.find_or_initialize_by(user_id: current_user.id, kind: item[:kind].to_s, channel: item[:channel].to_s)
        enabled = item[:enabled]
        raise ActiveRecord::Rollback unless [true, false].include?(enabled)

        row.enabled = enabled
        row.save || raise(ActiveRecord::Rollback)
      end
    end
    return render(json: { error: "invalid_preferences" }, status: :unprocessable_entity) unless saved

    render(json: { preferences: NotificationPreference.matrix(current_user) }, status: :ok)
  end
end
