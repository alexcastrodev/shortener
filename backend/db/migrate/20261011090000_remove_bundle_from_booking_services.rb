class RemoveBundleFromBookingServices < ActiveRecord::Migration[8.1]
  class MigrationForm < ActiveRecord::Base
    self.table_name = "forms"
  end

  def up
    changed = MigrationForm.where("fields::text LIKE :bundle OR published_snapshot::text LIKE :bundle", bundle: '%"bundle"%').filter_map do |form|
      fields = without_bundle(form.fields)
      snapshot = form.published_snapshot
      snapshot = snapshot.merge("fields" => without_bundle(snapshot["fields"])) if snapshot.is_a?(Hash) && snapshot["fields"].is_a?(Array)
      next if fields == form.fields && snapshot == form.published_snapshot

      form.update_columns(fields: fields, published_snapshot: snapshot)
      form.id
    end
    return if changed.empty?

    execute("UPDATE forms SET published_digest = encode(sha256(convert_to(published_snapshot::text, 'UTF8')), 'hex') WHERE published_snapshot IS NOT NULL AND id IN (#{changed.join(",")})")
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def without_bundle(fields)
    return fields unless fields.is_a?(Array)

    fields.map do |field|
      next field unless field.is_a?(Hash) && field["type"] == "booking" && field["services"].is_a?(Array)

      field.merge("services" => field["services"].map { |service| service.is_a?(Hash) ? service.except("bundle") : service })
    end
  end
end
