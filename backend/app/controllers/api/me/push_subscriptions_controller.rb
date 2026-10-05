class Api::Me::PushSubscriptionsController < ApplicationController
  before_action :authenticate_user!
  include AppointmentsGate

  def index
    render(json: { push_subscriptions: current_user.push_subscriptions.order(:id).map { |row| serialize(row) } }, status: :ok)
  end

  def create
    validate_contract(PushSubscriptionContract) do |params|
      subscription = PushSubscription.find_by(endpoint: params[:endpoint]) || PushSubscription.new(endpoint: params[:endpoint])
      subscription.assign_attributes(user: current_user, p256dh: params[:p256dh], auth: params[:auth], user_agent_label: request.user_agent.to_s.first(80).presence)
      if subscription.save
        render(json: { push_subscription: serialize(subscription) }, status: :created)
      else
        render(json: { errors: subscription.errors.to_hash }, status: :unprocessable_entity)
      end
    end
  end

  def destroy
    current_user.push_subscriptions.find(params[:id]).destroy!
    head(:no_content)
  end

  private

  def serialize(row)
    { id: row.id, label: row.user_agent_label, created_at: row.created_at.iso8601 }
  end
end
