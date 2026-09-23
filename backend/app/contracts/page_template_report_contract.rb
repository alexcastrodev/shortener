class PageTemplateReportContract < ApplicationContract
  params do
    required(:reason).filled(:string, included_in?: PageTemplateReport::REASONS)
  end
end
