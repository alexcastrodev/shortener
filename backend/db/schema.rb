# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_06_000100) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "abuse_signals", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "fingerprint", null: false
    t.datetime "first_seen_at", null: false
    t.string "kind", null: false
    t.datetime "last_seen_at", null: false
    t.jsonb "page_ids", default: [], null: false
    t.string "status", default: "open", null: false
    t.datetime "updated_at", null: false
    t.jsonb "user_ids", default: [], null: false
    t.index ["kind", "fingerprint"], name: "index_abuse_signals_on_kind_and_fingerprint", unique: true
    t.index ["status"], name: "index_abuse_signals_on_status"
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "audits", force: :cascade do |t|
    t.string "action"
    t.integer "associated_id"
    t.string "associated_type"
    t.integer "auditable_id"
    t.string "auditable_type"
    t.jsonb "audited_changes"
    t.string "comment"
    t.datetime "created_at"
    t.string "remote_address"
    t.string "request_uuid"
    t.integer "user_id"
    t.string "user_type"
    t.string "username"
    t.integer "version", default: 0
    t.index ["associated_type", "associated_id"], name: "associated_index"
    t.index ["auditable_type", "auditable_id", "version"], name: "auditable_index"
    t.index ["created_at"], name: "index_audits_on_created_at"
    t.index ["request_uuid"], name: "index_audits_on_request_uuid"
    t.index ["user_id", "user_type"], name: "user_index"
  end

  create_table "color_palettes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "custom_colors", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_color_palettes_on_user_id"
  end

  create_table "events", force: :cascade do |t|
    t.string "browser"
    t.datetime "clicked_at", null: false
    t.string "country_code"
    t.string "ip_address"
    t.string "platform"
    t.string "referer"
    t.string "region"
    t.bigint "shortlink_id", null: false
    t.string "user_agent"
    t.index ["shortlink_id"], name: "index_events_on_shortlink_id"
  end

  create_table "form_daily_stats", force: :cascade do |t|
    t.bigint "form_id", null: false
    t.date "day", null: false
    t.integer "views", default: 0, null: false
    t.integer "unique_views", default: 0, null: false
    t.integer "starts", default: 0, null: false
    t.index ["form_id", "day"], name: "index_form_daily_stats_on_form_id_and_day", unique: true
  end

  create_table "form_responses", force: :cascade do |t|
    t.bigint "form_id", null: false
    t.jsonb "answers", default: {}, null: false
    t.string "country", limit: 2
    t.string "platform"
    t.string "browser"
    t.string "source"
    t.string "idempotency_key", limit: 64
    t.datetime "created_at", null: false
    t.index ["form_id", "created_at"], name: "index_form_responses_on_form_id_and_created_at"
    t.index ["form_id", "id"], name: "index_form_responses_on_form_id_and_id"
    t.index ["form_id", "idempotency_key"], name: "index_form_responses_on_form_and_idempotency_key", unique: true, where: "(idempotency_key IS NOT NULL)"
    t.check_constraint "jsonb_typeof(answers) = 'object'::text AND octet_length(answers::text) <= 65536", name: "form_responses_answers_object_max_64kb"
  end

  create_table "form_uploads", force: :cascade do |t|
    t.bigint "form_id", null: false
    t.bigint "response_id"
    t.string "field_id", limit: 8, null: false
    t.string "token", limit: 24, null: false
    t.datetime "created_at", null: false
    t.index ["created_at"], name: "index_form_uploads_orphans", where: "(response_id IS NULL)"
    t.index ["form_id"], name: "index_form_uploads_on_form_id"
    t.index ["response_id"], name: "index_form_uploads_on_response_id"
    t.index ["token"], name: "index_form_uploads_on_token", unique: true
  end

  create_table "forms", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "public_id", null: false
    t.string "title", null: false
    t.text "description"
    t.text "thank_you_message"
    t.string "theme", default: "default", null: false
    t.jsonb "custom_colors"
    t.boolean "published", default: false, null: false
    t.jsonb "fields", default: [], null: false
    t.integer "responses_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "layout", default: "one_at_a_time", null: false
    t.bigint "shortlink_id"
    t.index ["public_id"], name: "index_forms_on_public_id", unique: true
    t.index ["shortlink_id"], name: "index_forms_on_shortlink_id"
    t.index ["user_id", "created_at"], name: "index_forms_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_forms_on_user_id"
    t.check_constraint "jsonb_typeof(fields) = 'array'::text", name: "forms_fields_is_array"
  end

  create_table "identities", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email"
    t.datetime "last_used_at"
    t.string "provider", null: false
    t.string "uid", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["provider", "uid"], name: "index_identities_on_provider_and_uid", unique: true
    t.index ["user_id", "provider"], name: "index_identities_on_user_id_and_provider", unique: true
    t.index ["user_id"], name: "index_identities_on_user_id"
  end

  create_table "mcp_tool_calls", force: :cascade do |t|
    t.bigint "oauth_grant_id", null: false
    t.string "tool", null: false
    t.string "status", null: false
    t.string "error_code"
    t.integer "duration_ms", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "records_returned", default: 0, null: false
    t.index ["created_at"], name: "index_mcp_tool_calls_on_created_at"
    t.index ["oauth_grant_id"], name: "index_mcp_tool_calls_on_oauth_grant_id"
  end

  create_table "oauth_access_tokens", force: :cascade do |t|
    t.bigint "oauth_grant_id", null: false
    t.string "token_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.index ["oauth_grant_id"], name: "index_oauth_access_tokens_on_oauth_grant_id"
    t.index ["token_digest"], name: "index_oauth_access_tokens_on_token_digest", unique: true
  end

  create_table "oauth_authorization_codes", force: :cascade do |t|
    t.bigint "oauth_grant_id", null: false
    t.string "code_digest", null: false
    t.string "code_challenge", null: false
    t.string "redirect_uri", null: false
    t.datetime "expires_at", null: false
    t.datetime "used_at"
    t.datetime "created_at", null: false
    t.index ["code_digest"], name: "index_oauth_authorization_codes_on_code_digest", unique: true
    t.index ["oauth_grant_id"], name: "index_oauth_authorization_codes_on_oauth_grant_id"
  end

  create_table "oauth_clients", force: :cascade do |t|
    t.string "client_id", null: false
    t.string "client_name", null: false
    t.jsonb "redirect_uris", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_oauth_clients_on_client_id", unique: true
  end

  create_table "oauth_grants", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "oauth_client_id", null: false
    t.jsonb "scopes", default: [], null: false
    t.string "resource", null: false
    t.datetime "revoked_at"
    t.datetime "last_used_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["oauth_client_id"], name: "index_oauth_grants_on_oauth_client_id"
    t.index ["user_id"], name: "index_oauth_grants_on_user_id"
  end

  create_table "oauth_refresh_tokens", force: :cascade do |t|
    t.bigint "oauth_grant_id", null: false
    t.string "token_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "absolute_expires_at", null: false
    t.datetime "used_at"
    t.datetime "created_at", null: false
    t.index ["oauth_grant_id"], name: "index_oauth_refresh_tokens_on_oauth_grant_id"
    t.index ["token_digest"], name: "index_oauth_refresh_tokens_on_token_digest", unique: true
  end

  create_table "page_link_clicks", force: :cascade do |t|
    t.string "browser"
    t.datetime "clicked_at", null: false
    t.string "country_code"
    t.string "ip_address"
    t.bigint "page_link_id", null: false
    t.string "platform"
    t.string "referer"
    t.string "region"
    t.string "user_agent"
    t.index ["page_link_id", "clicked_at"], name: "index_page_link_clicks_on_page_link_id_and_clicked_at"
    t.index ["page_link_id"], name: "index_page_link_clicks_on_page_link_id"
  end

  create_table "page_links", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.integer "clicks_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "icon"
    t.string "kind", default: "link", null: false
    t.string "label", null: false
    t.bigint "page_id", null: false
    t.integer "position", default: 0, null: false
    t.boolean "safe", default: true, null: false
    t.datetime "safe_checked_at"
    t.datetime "updated_at", null: false
    t.string "url"
    t.index ["page_id", "position"], name: "index_page_links_on_page_id_and_position"
  end

  create_table "page_template_reports", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "page_template_id", null: false
    t.string "reason", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["page_template_id", "user_id"], name: "index_page_template_reports_on_page_template_id_and_user_id", unique: true
    t.index ["page_template_id"], name: "index_page_template_reports_on_page_template_id"
    t.index ["user_id"], name: "index_page_template_reports_on_user_id"
  end

  create_table "page_templates", force: :cascade do |t|
    t.string "author_label"
    t.bigint "author_page_id"
    t.datetime "created_at", null: false
    t.string "description"
    t.datetime "hidden_at"
    t.jsonb "items", default: [], null: false
    t.string "name", null: false
    t.datetime "published_at"
    t.integer "reports_count", default: 0, null: false
    t.string "theme", default: "default", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "uses_count", default: 0, null: false
    t.string "visibility", default: "private", null: false
    t.index ["author_page_id"], name: "index_page_templates_on_author_page_id"
    t.index ["user_id"], name: "index_page_templates_on_user_id"
    t.index ["visibility", "hidden_at", "uses_count"], name: "idx_on_visibility_hidden_at_uses_count_757c1d2d8f"
  end

  create_table "pages", force: :cascade do |t|
    t.text "bio"
    t.datetime "created_at", null: false
    t.jsonb "custom_colors"
    t.datetime "deleted_at"
    t.string "display_title"
    t.datetime "expires_at"
    t.boolean "published", default: true, null: false
    t.string "slug", null: false
    t.string "theme", default: "default", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["deleted_at"], name: "index_pages_on_deleted_at"
    t.index ["slug"], name: "index_pages_on_slug", unique: true
    t.index ["user_id"], name: "index_pages_on_user_id"
  end

  create_table "shortlinks", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "deleted_at"
    t.integer "events_count", default: 0, null: false
    t.datetime "expires_at"
    t.datetime "inactive_at"
    t.datetime "last_accessed_at"
    t.string "original_url", null: false
    t.string "password_digest"
    t.boolean "safe", default: true, null: false
    t.datetime "safe_checked_at"
    t.string "short_code", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["deleted_at"], name: "index_shortlinks_on_deleted_at"
    t.index ["expires_at"], name: "index_shortlinks_on_expires_at", where: "((expires_at IS NOT NULL) AND (inactive_at IS NULL))"
    t.index ["short_code"], name: "index_shortlinks_on_short_code", unique: true
    t.index ["user_id"], name: "index_shortlinks_on_user_id"
  end

  create_table "solid_cable_messages", force: :cascade do |t|
    t.binary "channel", null: false
    t.bigint "channel_hash", null: false
    t.datetime "created_at", null: false
    t.binary "payload", null: false
    t.index ["channel"], name: "index_solid_cable_messages_on_channel"
    t.index ["channel_hash"], name: "index_solid_cable_messages_on_channel_hash"
    t.index ["created_at"], name: "index_solid_cable_messages_on_created_at"
  end

  create_table "solid_cache_entries", force: :cascade do |t|
    t.integer "byte_size", null: false
    t.datetime "created_at", null: false
    t.binary "key", null: false
    t.bigint "key_hash", null: false
    t.binary "value", null: false
    t.index ["byte_size"], name: "index_solid_cache_entries_on_byte_size"
    t.index ["key_hash", "byte_size"], name: "index_solid_cache_entries_on_key_hash_and_byte_size"
    t.index ["key_hash"], name: "index_solid_cache_entries_on_key_hash", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.boolean "admin", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "deactivated_at"
    t.string "email", null: false
    t.integer "failed_password_attempts", default: 0, null: false
    t.integer "login_attempts", default: 0, null: false
    t.string "login_token"
    t.datetime "login_token_sent_at"
    t.datetime "password_changed_at"
    t.string "password_digest"
    t.datetime "password_locked_until"
    t.string "pending_password_digest"
    t.datetime "sessions_revoked_at"
    t.integer "shortlinks_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.datetime "verified_at"
    t.datetime "deletion_requested_at"
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["deletion_requested_at"], name: "index_users_on_deletion_requested_at", where: "(deletion_requested_at IS NOT NULL)"
    t.index ["login_token"], name: "index_users_on_login_token", unique: true
    t.index ["verified_at", "created_at"], name: "index_users_on_verified_at_and_created_at"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "color_palettes", "users", on_delete: :cascade
  add_foreign_key "events", "shortlinks", on_delete: :cascade
  add_foreign_key "form_daily_stats", "forms", on_delete: :cascade
  add_foreign_key "form_responses", "forms", on_delete: :cascade
  add_foreign_key "form_uploads", "form_responses", column: "response_id", on_delete: :nullify
  add_foreign_key "form_uploads", "forms"
  add_foreign_key "forms", "shortlinks", on_delete: :nullify
  add_foreign_key "forms", "users", on_delete: :cascade
  add_foreign_key "identities", "users", on_delete: :cascade
  add_foreign_key "mcp_tool_calls", "oauth_grants", on_delete: :cascade
  add_foreign_key "oauth_access_tokens", "oauth_grants", on_delete: :cascade
  add_foreign_key "oauth_authorization_codes", "oauth_grants", on_delete: :cascade
  add_foreign_key "oauth_grants", "oauth_clients", on_delete: :cascade
  add_foreign_key "oauth_grants", "users", on_delete: :cascade
  add_foreign_key "oauth_refresh_tokens", "oauth_grants", on_delete: :cascade
  add_foreign_key "page_link_clicks", "page_links", on_delete: :cascade
  add_foreign_key "page_links", "pages", on_delete: :cascade
  add_foreign_key "page_template_reports", "page_templates", on_delete: :cascade
  add_foreign_key "page_template_reports", "users", on_delete: :cascade
  add_foreign_key "page_templates", "pages", column: "author_page_id", on_delete: :nullify
  add_foreign_key "page_templates", "users", on_delete: :cascade
  add_foreign_key "pages", "users"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
end
