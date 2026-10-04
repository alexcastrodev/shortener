sql() { PGPASSWORD=postgres psql -h db -U postgres -d production -tAc "$1"; }

response_columns_are_minimal() {
  local got want="answers,browser,country,created_at,form_id,id,idempotency_key,platform,source"
  got=$(sql "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name = 'form_responses'")
  [ "$got" = "$want" ] || { echo "$got"; return 1; }
}
no_ip_or_raw_agent_columns_in_form_tables() {
  local got
  got=$(sql "select table_name || '.' || column_name from information_schema.columns where table_name like 'form%' and column_name ~* '(^ip|_ip$|ip_address|user_agent|referer|referrer)'")
  [ -z "$got" ] || { echo "$got"; return 1; }
}
form_data_is_not_audited() {
  local got
  got=$(sql "select count(*) from audits where auditable_type in ('FormResponse', 'FormDailyStat')")
  [ "$got" = 0 ] || { echo "audit rows: $got"; return 1; }
}
answers_constraint_exists() {
  [ "$(sql "select count(*) from pg_constraint where conname = 'form_responses_answers_object_max_64kb'")" = 1 ]
}

t G07 M "form_responses has only date, country, device, browser, source and answers (no IP, no raw UA or referrer)" response_columns_are_minimal
t G07b M "no form table has an IP, user agent or referrer column" no_ip_or_raw_agent_columns_in_form_tables
t G08 M "responses and daily stats are never in audits" form_data_is_not_audited
t A11a M "the database caps answers at an object of 64 KB" answers_constraint_exists
