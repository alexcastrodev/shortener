module Forms
  module Covers
    extend self

    def prune(form)
      keep = [form.cover_token, (Snapshot.stored(form)["cover_token"] if form.published_snapshot.present?)].compact
      form.uploads.where(field_id: Form::COVER_FIELD).where.not(token: keep).find_each(&:destroy)
    end
  end
end
