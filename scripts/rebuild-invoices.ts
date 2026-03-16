/**
 * One-time invoice rebuild migration.
 *
 * Goal: produce exactly ONE invoice per invoiceable session, with exactly ONE
 * invoice_item per invoice, totalAmount === item amount, and consistent
 * sessionGroups JSON.
 *
 * Scope:
 *   - Regular sessions   (invoiceDone = true, NOT a TBC child of a package)
 *   - CoursePlus records (invoiceGenerated = true)
 *
 * Steps:
 *   1. Delete all receipts, invoice_items, invoices, document_counters  (full reset)
 *   2. Reset session.invoiceDone = false and course_plus.invoiceGenerated = false
 *   3. For each invoiceable session, generate one invoice + one item
 *   4. For each invoiceable course_plus, generate one invoice + one item
 *   5. Re-mark sessions/course_plus as invoiced
 *   6. Run validation queries and print results
 *
 * Usage:
 *   cd kdl-backend
 *   npx ts-node scripts/rebuild-invoices.ts          # dry-run (default)
 *   npx ts-node scripts/rebuild-invoices.ts --commit  # actually write
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

// ─── Configuration ───────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--commit');
const TODAY = new Date();
const YEAR_MONTH = `${TODAY.getFullYear()}${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function docId(counter: number): string {
  return `${YEAR_MONTH}-${counter.toString().padStart(3, '0')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
  });

  console.log('Connecting to database...');
  await ds.initialize();
  console.log('Connected.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — no writes will be performed ===');
    console.log('Pass --commit to actually execute.\n');
  }

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // ── Step 1: Full reset of invoice domain ──────────────────────────────

    console.log('Step 1: Clearing invoice domain tables...');

    const receiptCount = (await qr.query('SELECT COUNT(*) AS c FROM receipts'))[0].c;
    const itemCount = (await qr.query('SELECT COUNT(*) AS c FROM invoice_items'))[0].c;
    const invoiceCount = (await qr.query('SELECT COUNT(*) AS c FROM invoices'))[0].c;

    console.log(`  receipts:         ${receiptCount}`);
    console.log(`  invoice_items:    ${itemCount}`);
    console.log(`  invoices:         ${invoiceCount}`);

    if (!DRY_RUN) {
      await qr.query('DELETE FROM receipts');
      await qr.query('DELETE FROM invoice_items');
      await qr.query('DELETE FROM invoices');
      await qr.query('DELETE FROM document_counters');
    }
    console.log('  Cleared.\n');

    // ── Step 2: Reset flags ───────────────────────────────────────────────

    console.log('Step 2: Resetting invoiceDone / invoiceGenerated flags...');

    const sessionsToReset = (await qr.query(
      `SELECT COUNT(*) AS c FROM sessions WHERE "invoiceDone" = true`
    ))[0].c;
    const cpToReset = (await qr.query(
      `SELECT COUNT(*) AS c FROM course_plus WHERE "invoiceGenerated" = true`
    ))[0].c;

    console.log(`  sessions.invoiceDone = true:        ${sessionsToReset}`);
    console.log(`  course_plus.invoiceGenerated = true: ${cpToReset}`);

    if (!DRY_RUN) {
      await qr.query(`UPDATE sessions SET "invoiceDone" = false WHERE "invoiceDone" = true`);
      await qr.query(`UPDATE course_plus SET "invoiceGenerated" = false WHERE "invoiceGenerated" = true`);
    }
    console.log('  Reset.\n');

    // ── Step 3: Gather invoiceable sessions ───────────────────────────────
    //
    // An invoiceable session is one that:
    //   - has payment = 'paid' OR was previously invoiceDone
    //   - is NOT a TBC child (packageGroupId IS NULL OR packageGroupId = id)
    //
    // We use the "was previously invoiceDone" set captured BEFORE the reset.
    // Since we reset in step 2, we re-query the original set from the
    // pre-reset snapshot. But since we already reset, we need to use a
    // different approach: we invoice ALL sessions where payment != 'unpaid'
    // or that are package heads, excluding TBC children.

    console.log('Step 3: Querying invoiceable sessions...');

    // Sessions that should get invoices:
    //   - Main sessions (non-package OR package heads) that are paid
    //   - We consider "paid" as the indicator that an invoice should exist
    const sessions: Array<{
      id: number;
      studentId: number;
      courseId: number;
      classOptionId: number;
      packageGroupId: number | null;
      price: string | null;
      comment: string | null;
      student_name: string;
      course_title: string;
      tuitionFee: string;
    }> = await qr.query(`
      SELECT
        s.id,
        s."studentId",
        s."courseId",
        s."classOptionId",
        s."packageGroupId",
        s.price,
        s.comment,
        st.name   AS student_name,
        c.title   AS course_title,
        co."tuitionFee" AS "tuitionFee"
      FROM sessions s
      JOIN students st ON st.id = s."studentId"
      JOIN courses  c  ON c.id  = s."courseId"
      JOIN class_options co ON co.id = s."classOptionId"
      WHERE LOWER(s.payment) = 'paid'
        AND (s."packageGroupId" IS NULL OR s."packageGroupId" = s.id)
      ORDER BY s.id
    `);

    console.log(`  Found ${sessions.length} invoiceable sessions.\n`);

    // ── Step 4: Gather invoiceable course_plus ────────────────────────────

    console.log('Step 4: Querying invoiceable course_plus...');

    const coursePluses: Array<{
      id: number;
      sessionId: number;
      amount: string;
      description: string;
      student_name: string;
      course_title: string;
    }> = await qr.query(`
      SELECT
        cp.id,
        cp."sessionId",
        cp.amount,
        cp.description,
        st.name  AS student_name,
        c.title  AS course_title
      FROM course_plus cp
      JOIN sessions s  ON s.id  = cp."sessionId"
      JOIN students st ON st.id = s."studentId"
      JOIN courses  c  ON c.id  = s."courseId"
      WHERE LOWER(cp.status) = 'paid'
      ORDER BY cp.id
    `);

    console.log(`  Found ${coursePluses.length} invoiceable course_plus records.\n`);

    // ── Step 5: Generate invoices ─────────────────────────────────────────

    if (!DRY_RUN) {
      console.log('Step 5: Generating invoices...');
      let counter = 0;

      // 5a: Session invoices
      for (const s of sessions) {
        counter++;
        const documentIdStr = docId(counter);

        // Price: session.price if set (package sessions), else classOption.tuitionFee
        const amount = s.price != null ? parseFloat(s.price) : parseFloat(s.tuitionFee);

        // Description: for package sessions use comment (package name), else course title
        const isPackage = s.packageGroupId != null && s.packageGroupId === s.id;
        const courseName = isPackage && s.comment ? s.comment : s.course_title;
        const itemDescription = `${courseName} - ${s.student_name}`;

        // Determine transactionType
        const transactionType = 'course';

        // sessionGroups JSON
        const sessionGroups = JSON.stringify([
          { sessionId: String(s.id), transactionType, actualId: String(s.id) },
        ]);

        // Insert invoice
        const insertResult = await qr.query(
          `INSERT INTO invoices ("documentId", date, "paymentMethod", "totalAmount", "receiptDone",
                                 "studentId", "studentName", "courseName", "sessionGroups", "createdAt")
           VALUES ($1, $2, 'cash', $3, false, $4, $5, $6, $7, NOW())
           RETURNING id`,
          [documentIdStr, TODAY, amount, s.studentId, s.student_name, courseName, sessionGroups]
        );
        const invoiceId = insertResult[0].id;

        // Insert single item
        await qr.query(
          `INSERT INTO invoice_items ("invoiceId", description, amount)
           VALUES ($1, $2, $3)`,
          [invoiceId, itemDescription, amount]
        );

        // Mark session invoiceDone
        await qr.query(
          `UPDATE sessions SET "invoiceDone" = true WHERE id = $1`,
          [s.id]
        );

        // If package head, also mark TBC children
        if (isPackage) {
          await qr.query(
            `UPDATE sessions SET "invoiceDone" = true
             WHERE "packageGroupId" = $1 AND id != $1`,
            [s.id]
          );
        }
      }

      // 5b: CoursePlus invoices
      for (const cp of coursePluses) {
        counter++;
        const documentIdStr = docId(counter);
        const amount = parseFloat(cp.amount);
        const itemDescription = `${cp.description} - ${cp.student_name}`;
        const courseName = cp.course_title;

        const sessionGroups = JSON.stringify([
          { sessionId: `cp-${cp.id}`, transactionType: 'courseplus', actualId: `cp-${cp.id}` },
        ]);

        const insertResult = await qr.query(
          `INSERT INTO invoices ("documentId", date, "paymentMethod", "totalAmount", "receiptDone",
                                 "studentId", "studentName", "courseName", "sessionGroups", "createdAt")
           VALUES ($1, $2, 'cash', $3, false, $4, $5, $6, $7, NOW())
           RETURNING id`,
          [documentIdStr, TODAY, amount, 0, cp.student_name, courseName, sessionGroups]
        );
        const invoiceId = insertResult[0].id;

        await qr.query(
          `INSERT INTO invoice_items ("invoiceId", description, amount)
           VALUES ($1, $2, $3)`,
          [invoiceId, itemDescription, amount]
        );

        // Mark course_plus as invoiced
        await qr.query(
          `UPDATE course_plus SET "invoiceGenerated" = true WHERE id = $1`,
          [cp.id]
        );
      }

      // 5c: Set document counter
      await qr.query(
        `INSERT INTO document_counters (date, counter)
         VALUES ($1, $2)
         ON CONFLICT (date) DO UPDATE SET counter = $2`,
        [YEAR_MONTH, counter]
      );

      console.log(`  Generated ${counter} invoices (${sessions.length} sessions + ${coursePluses.length} course_plus).\n`);
    } else {
      console.log('Step 5: (skipped in dry-run)\n');
      console.log(`  Would generate ${sessions.length + coursePluses.length} invoices.\n`);
    }

    // ── Step 6: Validation ────────────────────────────────────────────────

    console.log('Step 6: Validation...\n');

    // 6a: totalAmount vs SUM(items.amount) mismatch
    const mismatches = await qr.query(`
      SELECT i.id, i."documentId", i."totalAmount", COALESCE(SUM(ii.amount), 0) AS items_total
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii."invoiceId" = i.id
      GROUP BY i.id, i."documentId", i."totalAmount"
      HAVING i."totalAmount" != COALESCE(SUM(ii.amount), 0)
    `);
    console.log(`  totalAmount vs items mismatch: ${mismatches.length} rows`);
    if (mismatches.length > 0 && mismatches.length <= 10) {
      console.table(mismatches);
    }

    // 6b: Invoices with != 1 item
    const multiItem = await qr.query(`
      SELECT i.id, i."documentId", COUNT(ii.id) AS item_count
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii."invoiceId" = i.id
      GROUP BY i.id, i."documentId"
      HAVING COUNT(ii.id) != 1
    `);
    console.log(`  Invoices with != 1 item:       ${multiItem.length} rows`);

    // 6c: Invoices with != 1 sessionGroup entry
    const multiGroup = await qr.query(`
      SELECT id, "documentId", json_array_length("sessionGroups"::json) AS group_count
      FROM invoices
      WHERE json_array_length("sessionGroups"::json) != 1
    `);
    console.log(`  Invoices with != 1 group:      ${multiGroup.length} rows`);

    // 6d: Duplicate session coverage (same session referenced by >1 invoice)
    const dupSession = await qr.query(`
      SELECT val->>'actualId' AS actual_id, COUNT(*) AS invoice_count
      FROM invoices, json_array_elements("sessionGroups"::json) AS val
      GROUP BY val->>'actualId'
      HAVING COUNT(*) > 1
    `);
    console.log(`  Sessions in >1 invoice:        ${dupSession.length} rows`);

    // 6e: Total counts
    const finalInvoices = (await qr.query('SELECT COUNT(*) AS c FROM invoices'))[0].c;
    const finalItems = (await qr.query('SELECT COUNT(*) AS c FROM invoice_items'))[0].c;
    const finalReceipts = (await qr.query('SELECT COUNT(*) AS c FROM receipts'))[0].c;
    console.log(`\n  Final counts:`);
    console.log(`    invoices:      ${finalInvoices}`);
    console.log(`    invoice_items: ${finalItems}`);
    console.log(`    receipts:      ${finalReceipts}`);
    console.log(`    ratio:         ${finalItems / finalInvoices} items/invoice`);

    // ── Commit or rollback ────────────────────────────────────────────────

    if (DRY_RUN) {
      console.log('\nDRY RUN — rolling back all changes.');
      await qr.rollbackTransaction();
    } else {
      console.log('\nCommitting...');
      await qr.commitTransaction();
      console.log('Done.');
    }
  } catch (err) {
    console.error('\nError — rolling back transaction:', err);
    await qr.rollbackTransaction();
    process.exitCode = 1;
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main();
