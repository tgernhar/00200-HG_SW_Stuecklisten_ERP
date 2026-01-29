-- ============================================================
-- HUGWAWI DMS Link Tables - Neue Verknüpfungstabellen
-- ============================================================
-- Diese Tabellen müssen in der HUGWAWI-Datenbank erstellt werden,
-- um Dokumente mit Auftragsartikeln, Stücklistenartikeln und 
-- Arbeitsgängen zu verknüpfen.
-- 
-- Ausführen auf: hugwawi (HUGWAWI Datenbank)
-- ============================================================

USE `hugwawi`;

-- ============================================================
-- 1. dms_order_article - Dokument <-> Auftragsartikel
-- ============================================================
-- Verknüpft DMS-Dokumente mit Auftragsartikeln (order_article)
-- Dies ermöglicht das Anhängen von Dokumenten an einzelne 
-- Positionen eines Auftrags.

CREATE TABLE IF NOT EXISTS `dms_order_article` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `dmsId` INT(11) NOT NULL COMMENT 'FK -> dms_document.id',
    `order_article_id` INT(11) NOT NULL COMMENT 'FK -> order_article.id',
    `created` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_dms_order_article_dmsId` (`dmsId`) USING BTREE,
    INDEX `idx_dms_order_article_order_article_id` (`order_article_id`) USING BTREE,
    UNIQUE KEY `uk_dms_order_article` (`dmsId`, `order_article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 
COMMENT='Verknüpfung DMS-Dokumente mit Auftragsartikeln';

-- ============================================================
-- 2. dms_packingnote_details - Dokument <-> Stücklistenartikel
-- ============================================================
-- Verknüpft DMS-Dokumente mit Stücklistenartikeln (BOM Items)
-- aus der packingnote_details Tabelle.

CREATE TABLE IF NOT EXISTS `dms_packingnote_details` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `dmsId` INT(11) NOT NULL COMMENT 'FK -> dms_document.id',
    `packingnote_details_id` INT(11) NOT NULL COMMENT 'FK -> packingnote_details.id',
    `created` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_dms_packingnote_details_dmsId` (`dmsId`) USING BTREE,
    INDEX `idx_dms_packingnote_details_bom` (`packingnote_details_id`) USING BTREE,
    UNIQUE KEY `uk_dms_packingnote_details` (`dmsId`, `packingnote_details_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 
COMMENT='Verknüpfung DMS-Dokumente mit Stücklistenartikeln (BOM Items)';

-- ============================================================
-- 3. dms_workplan_details - Dokument <-> Arbeitsgang
-- ============================================================
-- Verknüpft DMS-Dokumente mit Arbeitsgängen aus dem Arbeitsplan
-- (workplan_details Tabelle).

CREATE TABLE IF NOT EXISTS `dms_workplan_details` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `dmsId` INT(11) NOT NULL COMMENT 'FK -> dms_document.id',
    `workplan_details_id` INT(11) NOT NULL COMMENT 'FK -> workplan_details.id',
    `created` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_dms_workplan_details_dmsId` (`dmsId`) USING BTREE,
    INDEX `idx_dms_workplan_details_workplan` (`workplan_details_id`) USING BTREE,
    UNIQUE KEY `uk_dms_workplan_details` (`dmsId`, `workplan_details_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 
COMMENT='Verknüpfung DMS-Dokumente mit Arbeitsgängen';

-- ============================================================
-- Verification Queries
-- ============================================================
-- Nach der Erstellung können Sie die Tabellen mit folgenden 
-- Queries überprüfen:

-- SHOW CREATE TABLE dms_order_article;
-- SHOW CREATE TABLE dms_packingnote_details;
-- SHOW CREATE TABLE dms_workplan_details;

-- SELECT COUNT(*) FROM dms_order_article;
-- SELECT COUNT(*) FROM dms_packingnote_details;
-- SELECT COUNT(*) FROM dms_workplan_details;
