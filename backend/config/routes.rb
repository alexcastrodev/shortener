Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  match "/rails/active_storage/direct_uploads", via: :all, to: ->(_env) { [404, {}, []] }
  match "/rails/active_storage/disk/*rest", via: :all, to: ->(_env) { [404, {}, []] }

  get "/.well-known/oauth-protected-resource", to: "well_known/oauth#protected_resource", format: false
  get "/.well-known/oauth-protected-resource/mcp", to: "well_known/oauth#protected_resource", format: false
  get "/.well-known/oauth-authorization-server", to: "well_known/oauth#authorization_server", format: false
  get "/mcp", to: "mcp/endpoint#handle", format: false
  post "/mcp", to: "mcp/endpoint#handle", format: false
  delete "/mcp", to: "mcp/endpoint#handle", format: false
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
      resource :appointments_health, only: [:show], controller: "appointments_health"
      resources :page_templates, only: [:index] do
        member { post "toggle_hidden", to: "page_templates#toggle_hidden" }
      end
      resources :abuse_signals, only: [:index] do
        member { post "dismiss", to: "abuse_signals#dismiss" }
      end
    end

    namespace :me do
      resource :users, path: "", only: [:show, :update, :destroy] do
      end
      resources :shortlinks, only: [:index, :show, :create, :destroy, :update] do
        get "statistics", to: "shortlinks#statistics"
        get "qr_code", to: "shortlinks#qr_code"
      end
      resource :password, only: [:update]
      post "appointments/generate_times", to: "appointment_times#create"
      resource :oauth_authorization, path: "oauth/authorization", only: [:show, :create], controller: "oauth_authorizations"
      resources :oauth_grants, only: [:index, :destroy]
      resources :form_templates, only: [:index]
      resource :agenda, only: [:show], controller: "agenda"
      resource :calendar_feed, only: [:show, :create, :destroy]
      resource :notification_preferences, only: [:show, :update]
      resources :appointments, only: [] do
        member do
          post :reschedule
          post :remind
          post :approve
          post :decline
          post :cancel
        end
      end
      get "push_config", to: "push_subscriptions#vapid"
      resources :push_subscriptions, only: [:index, :create, :destroy]
      resources :notifications, only: [:index] do
        member { post :read }
        collection { post :read_all }
      end
      resources :forms, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :publish
          post :unpublish
          post :discard
          post :apply_template
          post :duplicate
        end
        resources :responses, only: [:index, :show, :destroy], controller: "form_responses"
        delete "responses", to: "form_responses#destroy_all"
        get "responses_export", to: "form_responses#export", format: false
        get "appointments", to: "form_appointments#index", format: false
        get "waitlist", to: "form_waitlist#index", format: false
        get "appointments_export", to: "form_appointments#export", format: false
        get :summary, to: "form_responses#summary"
        get "uploads/:id", to: "form_uploads#show", as: :upload, format: false
        resource :cover, only: [:show, :update, :destroy], controller: "form_covers", format: false
        resources :fields, only: [:create, :update, :destroy], controller: "form_fields" do
          collection { patch :reorder }
        end
      end
      resources :page_templates, only: [:index, :create, :update, :destroy]
      resources :color_palettes, only: [:index, :create, :destroy]
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
      post "forms/:public_id/waitlist", to: "waitlists#create", as: :form_waitlist, format: false
      get "waitlist/:token", to: "waitlist_entries#show", as: :waitlist_entry, format: false
      post "waitlist/:token/claim", to: "waitlist_entries#claim", as: :waitlist_claim, format: false
      post "waitlist/:token/leave", to: "waitlist_entries#leave", as: :waitlist_leave, format: false
      get "forms/:public_id/slots", to: "form_slots#index", as: :form_slots, format: false
      get "forms/:public_id/cover/:token", to: "form_covers#show", as: :form_cover, format: false
      get "calendar/:token", to: "calendars#show", as: :calendar, format: false
      get "appointments/:token", to: "appointments#show", as: :appointment, format: false
      post "appointments/:token/cancel", to: "appointments#cancel", as: :appointment_cancel, format: false
      get "appointment_decisions/:token", to: "appointment_decisions#show", as: :appointment_decision, format: false
      get "appointment_verifications/:token", to: "appointment_verifications#show", as: :appointment_verification, format: false
      post "appointment_verifications/:token", to: "appointment_verifications#create", as: :appointment_verification_create, format: false
      post "appointment_decisions/:token", to: "appointment_decisions#create", as: :appointment_decision_create, format: false
      post "forms/:public_id/responses", to: "form_responses#create", as: :form_responses, format: false
      post "forms/:public_id/events", to: "form_events#create", as: :form_events, format: false
      post "forms/:public_id/fields/:field_id/uploads", to: "form_uploads#create", as: :form_uploads, format: false
      get "shortlinks/:short_code", to: "shortlink_unlocks#show", as: :locked_shortlink
      post "shortlinks/:short_code/unlock", to: "shortlink_unlocks#create", as: :shortlink_unlock
    end
  end
end
