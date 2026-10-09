# Approval queue — no actions below executed

## Production migration and domain identity

This branch contains an LFNYC service website inside the existing AHA repository. Production remains the AHA site. Replacing the live AHA property is a business change; the existing `littlefightnyc.com` property is separate and is outside this mission.

The preview is built and deployed without provider credentials, functions, migrations, live forms or analytics. No spend or missing credential blocks this path.

The final report will include the exact reviewed commit, compare URL, branch merge command and guarded production build/deployment command. Approval must name whether to replace the AHA property or migrate this artifact to another approved site/domain. No domain, DNS, billing or provider-retirement command will run on assumption.

## Lead delivery

The preview prepares a local email draft addressed to hello@littlefightnyc.com. It never sends a message. Enabling a server-side lead inbox or automated email requires explicit scope and a verified LFNYC recipient/service; AHA's existing forms and Resend setup must not be reused silently.

## Old commerce infrastructure

Retiring AHA's Square/APLIIQ/Printful/Netlify Database/email resources, deleting data or migrations, or changing production auth and scheduled-operation settings is not authorized. The new preview artifact excludes all of them and has no database queries. Keep the old source and data for recovery.
