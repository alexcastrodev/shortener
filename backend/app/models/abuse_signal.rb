# Several new accounts publishing the same page (same text or same set of
# links) in a short window: a pattern of phishing and spam campaigns. Found
# by DetectPageAbuseJob; admins decide what to do.
# == Schema Information
#
# Table name: abuse_signals
#
#  id            :bigint           not null, primary key
#  fingerprint   :string           not null
#  first_seen_at :datetime         not null
#  kind          :string           not null
#  last_seen_at  :datetime         not null
#  page_ids      :jsonb            not null
#  status        :string           default("open"), not null
#  user_ids      :jsonb            not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_abuse_signals_on_kind_and_fingerprint  (kind,fingerprint) UNIQUE
#  index_abuse_signals_on_status                (status)
#
class AbuseSignal < ApplicationRecord
  KINDS = ["same_text", "same_links"].freeze
  STATUSES = ["open", "dismissed"].freeze

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :fingerprint, presence: true

  scope :pending, -> { where(status: "open") }

  def users
    User.where(id: user_ids)
  end

  def pages
    Page.with_deleted.where(id: page_ids)
  end

  def dismiss!
    update!(status: "dismissed")
  end
end
