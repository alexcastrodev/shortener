class CreateOauth < ActiveRecord::Migration[8.1]
  def change
    create_table(:oauth_clients) do |t|
      t.string(:client_id, null: false)
      t.string(:client_name, null: false)
      t.jsonb(:redirect_uris, null: false, default: [])
      t.timestamps
    end
    add_index(:oauth_clients, :client_id, unique: true)

    create_table(:oauth_grants) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.references(:oauth_client, null: false, foreign_key: { on_delete: :cascade })
      t.jsonb(:scopes, null: false, default: [])
      t.string(:resource, null: false)
      t.datetime(:revoked_at)
      t.datetime(:last_used_at)
      t.timestamps
    end

    create_table(:oauth_authorization_codes) do |t|
      t.references(:oauth_grant, null: false, foreign_key: { on_delete: :cascade })
      t.string(:code_digest, null: false)
      t.string(:code_challenge, null: false)
      t.string(:redirect_uri, null: false)
      t.datetime(:expires_at, null: false)
      t.datetime(:used_at)
      t.datetime(:created_at, null: false)
    end
    add_index(:oauth_authorization_codes, :code_digest, unique: true)

    create_table(:oauth_access_tokens) do |t|
      t.references(:oauth_grant, null: false, foreign_key: { on_delete: :cascade })
      t.string(:token_digest, null: false)
      t.datetime(:expires_at, null: false)
      t.datetime(:created_at, null: false)
    end
    add_index(:oauth_access_tokens, :token_digest, unique: true)

    create_table(:oauth_refresh_tokens) do |t|
      t.references(:oauth_grant, null: false, foreign_key: { on_delete: :cascade })
      t.string(:token_digest, null: false)
      t.datetime(:expires_at, null: false)
      t.datetime(:absolute_expires_at, null: false)
      t.datetime(:used_at)
      t.datetime(:created_at, null: false)
    end
    add_index(:oauth_refresh_tokens, :token_digest, unique: true)
  end
end
