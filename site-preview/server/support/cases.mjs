import { createHash } from 'node:crypto';
import { CLIENT } from '../platform/client.mjs';
export async function saveSupportCase(db,{id,topic,email,text,reference}) {
  const digest=createHash('sha256').update(`${email}\n${topic}\n${text}`).digest('hex');
  const [row]=await db.sql`WITH saved AS (
    INSERT INTO aha_support_cases(id,request_hash,topic,customer_email,message_text,order_reference)
    VALUES(${id},${digest},${topic},${email},${text},${reference || null})
    ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id WHERE aha_support_cases.request_hash=EXCLUDED.request_hash RETURNING *
  ), notification AS (
    INSERT INTO aha_order_notifications(dedupe_key,kind,recipient,payload_json)
    SELECT 'support:' || id,'support_request',${CLIENT.client.email},
      jsonb_build_object('caseId',id,'topic',topic,'text',message_text,'replyTo',customer_email) FROM saved
    ON CONFLICT(dedupe_key) DO NOTHING
  ) SELECT id FROM saved`;
  if(!row) throw new Error('support_request_conflict');
  return row.id;
}
export async function listSupportCases(db) {
  return db.sql`SELECT id,topic,customer_email,message_text,order_reference,state,created_at FROM aha_support_cases
    WHERE state <> 'resolved' ORDER BY created_at ASC LIMIT 100`;
}
