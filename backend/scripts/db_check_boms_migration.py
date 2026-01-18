from __future__ import annotations

import sys
from pathlib import Path

import sqlalchemy as sa

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.config import settings


def main() -> None:
    eng = sa.create_engine(settings.DATABASE_URL)
    with eng.connect() as c:
        boms_table = c.execute(
            sa.text(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema=DATABASE() AND table_name=:t"
            ),
            {"t": "boms"},
        ).scalar()
        bom_id_col = c.execute(
            sa.text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema=DATABASE() AND table_name=:tn AND column_name=:cn"
            ),
            {"tn": "articles", "cn": "bom_id"},
        ).scalar()
        pos_sub_col = c.execute(
            sa.text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema=DATABASE() AND table_name=:tn AND column_name=:cn"
            ),
            {"tn": "articles", "cn": "pos_sub"},
        ).scalar()
        version = c.execute(sa.text("SELECT version_num FROM alembic_version")).fetchall()

    print("boms_table", boms_table)
    print("articles.bom_id", bom_id_col)
    print("articles.pos_sub", pos_sub_col)
    print("alembic_version", version)


if __name__ == "__main__":
    main()

