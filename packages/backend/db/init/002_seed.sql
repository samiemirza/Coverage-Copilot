-- MVP scope (build-spec §3): one sample business, echoing persona "Jane."
-- Policy PDFs are seeded in Milestone 2 once the ingestion pipeline exists.

INSERT INTO businesses (name, industry, naics_code, profile)
VALUES (
  'Jane''s Kitchen',
  'Full-service restaurant',
  '722511',
  '{"employees": 20, "servesAlcohol": true, "hasOutdoorSeating": true}'::jsonb
);
