Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  namespace :api do
    post "login_request", to: "sessions#create"
    post "login_verify", to: "sessions#verify"
    resources :shortlinks, only: [:create]

    # TODO: Implement frontend
    # namespace :admin do
    #   resources :users, only: [:index]
    # end

    namespace :me do
      resource :users, path: "", only: [:show] do
      end
      resources :shortlinks, only: [:index, :show, :create, :destroy] do
        get "statistics", to: "shortlinks#statistics"
      end
    end
  end
end
