module Forms
  module BackfillSnapshots
    extend self

    def call
      connection = ActiveRecord::Base.connection
      connection.execute(<<~SQL)
        UPDATE forms
        SET published_snapshot = jsonb_build_object(
              'title', title,
              'description', description,
              'thank_you_message', thank_you_message,
              'theme', theme,
              'custom_colors', custom_colors,
              'layout', layout,
              'fields', fields
            ),
            published_version = 1
        WHERE published = TRUE AND published_snapshot IS NULL
      SQL
      connection.execute(<<~SQL)
        UPDATE forms
        SET published_digest = encode(sha256(convert_to(published_snapshot::text, 'UTF8')), 'hex')
        WHERE published_snapshot IS NOT NULL AND published_digest IS NULL
      SQL
      connection.execute(<<~SQL)
        UPDATE form_responses
        SET published_version = 1
        FROM forms
        WHERE forms.id = form_responses.form_id
          AND forms.published_version = 1
          AND form_responses.published_version IS NULL
      SQL
    end
  end
end
