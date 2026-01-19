import os
import sys

import pymysql


def main() -> int:
    host = os.environ.get("DB_HOST", "localhost")
    port = int(os.environ.get("DB_PORT", "3306"))
    user = os.environ.get("DB_USER", "app_user")
    password = os.environ.get("DB_PASSWORD", "app_password")
    database = os.environ.get("DB_NAME", "stuecklisten_erp")

    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'articles'
                  AND COLUMN_NAME = 'sw_origin'
                """
            )
            exists = int(cur.fetchone()[0] or 0)
            print("sw_origin exists:", exists)
            if not exists:
                cur.execute(
                    "ALTER TABLE articles ADD COLUMN sw_origin TINYINT(1) NOT NULL DEFAULT 0"
                )
                print("added sw_origin")
            else:
                print("no change")

            # Backfill: existing SOLIDWORKS-imported rows should be sw_origin=1.
            # Use the legacy heuristic (paths present) but keep Bestellartikel (pos_sub>0) as false.
            cur.execute(
                """
                SELECT COUNT(*)
                FROM articles
                WHERE sw_origin = 0
                  AND IFNULL(pos_sub, 0) = 0
                  AND (
                    (sldasm_sldprt_pfad IS NOT NULL AND sldasm_sldprt_pfad <> '')
                    OR (slddrw_pfad IS NOT NULL AND slddrw_pfad <> '')
                    OR (pfad IS NOT NULL AND pfad <> '')
                  )
                """
            )
            before = int(cur.fetchone()[0] or 0)
            print("backfill candidates:", before)

            cur.execute(
                """
                UPDATE articles
                SET sw_origin = 1
                WHERE sw_origin = 0
                  AND IFNULL(pos_sub, 0) = 0
                  AND (
                    (sldasm_sldprt_pfad IS NOT NULL AND sldasm_sldprt_pfad <> '')
                    OR (slddrw_pfad IS NOT NULL AND slddrw_pfad <> '')
                    OR (pfad IS NOT NULL AND pfad <> '')
                  )
                """
            )
            print("backfilled rows:", getattr(cur, "rowcount", None))

            cur.execute("SELECT COUNT(*) FROM articles WHERE sw_origin = 1")
            total_true = int(cur.fetchone()[0] or 0)
            print("total sw_origin=true:", total_true)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

