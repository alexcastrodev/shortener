# frozen_string_literal: true

module Callable
  extend ActiveSupport::Concern

  class_methods do
    def call(*args, **kwargs, &block)
      new(*args, **kwargs, &block).call
    end
  end
end
