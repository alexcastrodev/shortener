Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  get "/.well-known/oauth-protected-resource", to: "well_known/oauth#protected_resource", format: false
  get "/.well-known/oauth-protected-resource/mcp", to: "well_known/oauth#protected_resource", format: false
  get "/.well-known/oauth-authorization-server", to: "well_known/oauth#authorization_server", format: false
  post "/oauth/register", to: "oauth/registrations#create", format: false
  post "/oauth/token", to: "oauth/tokens#create", format: false
  post "/oauth/revoke", to: "oauth/revocations#create", format: false

  namespace :api do
    post "login_request", to: "sessions#create"
    post "login_verify", to: "sessions#verify"
    delete "logout", to: "sessions#destroy"
    post "login/password", to: "sessions#password"
    post "login/google", to: "sessions#google"
    post "signup", to: "registrations#create"
    post "password/forgot", to: "password_resets#create"
    post "password/reset", to: "password_resets#update"

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
      resources :page_templates, only: [:index] do
        member { post "toggle_hidden", to: "page_templates#toggle_hidden" }
      end
      resources :abuse_signals, only: [:index] do
        member { post "dismiss", to: "abuse_signals#dismiss" }
      end
    end

    namespace :me do
      resource :users, path: "", only: [:show] do
      end
      resources :shortlinks, only: [:index, :show, :create, :destroy, :update] do
        get "statistics", to: "shortlinks#statistics"
        get "qr_code", to: "shortlinks#qr_code"
      end
      resource :password, only: [:update]
      resource :oauth_authorization, path: "oauth/authorization", only: [:show, :create], controller: "oauth_authorizations"
      resources :oauth_grants, only: [:index, :destroy]
      resources :form_templates, only: [:index]
      resources :forms, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :publish
          post :unpublish
          post :apply_template
          post :duplicate
        end
        resources :responses, only: [:index, :show, :destroy], controller: "form_responses"
        delete "responses", to: "form_responses#destroy_all"
        get :summary, to: "form_responses#summary"
        resources :fields, only: [:create, :update, :destroy], controller: "form_fields" do
          collection { patch :reorder }
        end
      end
      resources :page_templates, only: [:index, :create, :update, :destroy]
      resources :community_templates, only: [:index] do
        member { post "report", to: "community_templates#report" }
      end
      resources :pages, only: [:index, :show, :create, :update, :destroy] do
        post "avatar", to: "pages#upload_avatar"
        delete "avatar", to: "pages#destroy_avatar"
        get "qr_code", to: "pages#qr_code"
        get "statistics", to: "pages#statistics"
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
      resources :forms, only: [:show], param: :public_id, format: false
      post "forms/:public_id/responses", to: "form_responses#create", as: :form_responses, format: false
      post "forms/:public_id/events", to: "form_events#create", as: :form_events, format: false
      get "shortlinks/:short_code", to: "shortlink_unlocks#show", as: :locked_shortlink
      post "shortlinks/:short_code/unlock", to: "shortlink_unlocks#create", as: :shortlink_unlock
    end
  end
end
