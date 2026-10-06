class Api::Me::AppointmentTimesController < ApplicationController
  before_action :authenticate_user!

  def create
    validate_contract(GenerateTimesContract) do |params|
      result = Appointments::GenerateTimes.call(
        from: params[:from],
        to: params[:to],
        step: params[:step],
        duration: params.fetch(:duration, 60),
        lunch: params[:lunch],
        blocks: params.fetch(:blocks, []),
      )
      status = result.errors.any? ? :unprocessable_entity : :ok
      render(json: { times: result.times, warnings: result.warnings, errors: result.errors, generator: result.generator }, status: status)
    end
  end
end
