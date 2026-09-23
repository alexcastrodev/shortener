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
    delete "logout", to: "sessions#destroy"

    namespace :admin do
      resources :users, only: [:index] do
        member do
          post "toggle_active", to: "users#toggle_active"
        end
      end
      resources :shortlinks, only: [:index] do
        member do
          post "toggle_safe", to: "shortlinks#toggle_safe"
          post "toggle_active", to: "shortlinks#toggle_active"
        end
      end
      resources :audits, only: [:index]
    end

    namespace :me do
      resource :users, path: "", only: [:show] do
      end
      resources :shortlinks, only: [:index, :show, :create, :destroy, :update] do
        get "statistics", to: "shortlinks#statistics"
        get "qr_code", to: "shortlinks#qr_code"
      end
      resources :page_templates, only: [:index, :create, :destroy]
      resources :pages, only: [:index, :show, :create, :update, :destroy] do
        post "avatar", to: "pages#upload_avatar"
        delete "avatar", to: "pages#destroy_avatar"
        get "qr_code", to: "pages#qr_code"
        post "apply_template", to: "pages#apply_template"
        resources :page_links, path: "links", only: [:create, :update, :destroy] do
          collection { patch "reorder", to: "page_links#reorder" }
        end
      end
    end

    # Slugs may contain dots ("jane.doe"), which Rails would otherwise read
    # as a format extension.
    namespace :public do
      constraints(slug: %r{[^/]+}) do
        resources :pages, only: [:show], param: :slug, format: false
        post "pages/:slug/links/:page_link_id/click", to: "page_link_clicks#create", as: :page_link_click, format: false
      end
      get "shortlinks/:short_code", to: "shortlink_unlocks#show", as: :locked_shortlink
      post "shortlinks/:short_code/unlock", to: "shortlink_unlocks#create", as: :shortlink_unlock
    end
  end
end
