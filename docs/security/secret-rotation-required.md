# Secret Rotation Required

The repository previously tracked local scratch/session artifacts containing secret-like values. Do not reuse those values.

Rotate these categories manually in the authoritative secret stores:

- Supabase service-role and secret keys exposed in prior tracked scratch files.
- Meta and WhatsApp access tokens exposed in prior tracked scratch files.
- Internal cron, vault, or webhook secrets if they were copied from the prior session notes.

After rotation, update only approved environment/secret stores. Do not commit real secret values to source control.
