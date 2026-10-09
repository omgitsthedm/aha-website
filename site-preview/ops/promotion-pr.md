Replaces the catalog-gated public experience with the reviewed After Hours Agenda editorial website: 16 pages, permanent navigation, captioned existing imagery, clear paused-order status and an unsent email-draft support flow. AHA's brand and `afterhoursagenda.com` stay unchanged. The user approved moving this candidate forward after reviewing the hosted preview.

This is a disclosed static runtime migration: automatic newsletter signup, customer order lookup, operational APIs and provider callbacks are not in the new artifact. Existing source, accounts, credentials and historical provider/customer data are preserved. This PR does not reopen sales or authorize any provider/data mutation.

Root Netlify configuration targets `site-preview` with Node 24. Preview builds retain noindex; production builds require the exact AHA domain and deliberate production flag. Existing Google/Bing ownership files are copied byte for byte. Required check names remain intact; production browser and performance checks now test the actual candidate with installed Chrome. Lighthouse budgets use the local production artifact; the report distinguishes them from hosted and field measurements.

Validation: preview and production lint/types/build/artifact tests, full static-app dependency audit, desktop/mobile/no-JS/keyboard/contact/browser checks, existing legacy CI, security/dependency review and both Lighthouse profiles. See check results for exact status.

Reviewed preview: https://6ac8af91c681bfc763902db4--afterhoursagenda.netlify.app

Release target: Netlify site `275b4115-16bf-42fb-9b36-6bce9bb93608`. The verified NETLIFY_NEXT_PLUGIN_SKIP=true build flag keeps any old UI-installed Next runtime inert without changing live host settings. GitHub requires one independent review and nine named checks; no bypass is requested. A squash merge with a release subject without `[skip netlify]` triggers production. Do not promote the noindex draft unchanged. No domain, DNS, spend, provider account or other project change is included.
