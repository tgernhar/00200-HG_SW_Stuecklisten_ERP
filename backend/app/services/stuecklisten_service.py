"""
Stücklisten Data Service Layer
Provides access to BOM/Stücklisten data from HUGWAWI.
"""
from typing import Optional, List, Dict, Any


def get_materialgroups_for_autocomplete(
    db_connection,
    search_term: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Warengruppen-Suche für Autocomplete.
    
    Args:
        db_connection: MySQL connection to HUGWAWI
        search_term: Suchbegriff für article_materialgroup.name
        limit: Maximale Anzahl Ergebnisse
    
    Returns:
        List of {id, name} dicts
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT id, name
            FROM article_materialgroup
            WHERE name LIKE %s AND active = 1
            ORDER BY name ASC
            LIMIT %s
        """
        cursor.execute(query, (f"%{search_term}%", limit))
        results = cursor.fetchall()
        return results
    finally:
        cursor.close()


def get_articles_for_autocomplete(
    db_connection,
    search_term: str,
    materialgroup_id: Optional[int] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Artikelnummern-Suche für Autocomplete.
    
    Args:
        db_connection: MySQL connection to HUGWAWI
        search_term: Suchbegriff für article.articlenumber
        materialgroup_id: Optional filter by materialgroup
        limit: Maximale Anzahl Ergebnisse
    
    Returns:
        List of {id, articlenumber, index, description} dicts
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        conditions = ["a.articlenumber LIKE %s", "a.active = 1"]
        params = [f"%{search_term}%"]
        
        if materialgroup_id:
            conditions.append("a.materialgroup = %s")
            params.append(materialgroup_id)
        
        params.append(limit)
        
        query = f"""
            SELECT 
                a.id,
                a.articlenumber,
                a.`index`,
                a.description
            FROM article a
            WHERE {' AND '.join(conditions)}
            ORDER BY a.articlenumber ASC
            LIMIT %s
        """
        cursor.execute(query, tuple(params))
        results = cursor.fetchall()
        return results
    finally:
        cursor.close()


def search_articles_with_bom(
    db_connection,
    materialgroup_id: Optional[int] = None,
    articlenumber: Optional[str] = None,
    is_sub: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """
    Sucht Artikel die eine Stückliste (packingnote) haben.
    
    Die Verknüpfung erfolgt über:
    - packingnote_details.article = article.id AND packingnote_details.isMaster = 1
    - packingnote_relation.detail = packingnote_details.id
    - packingnote_relation.packingNoteId = packingnote.id
    
    Args:
        db_connection: MySQL connection to HUGWAWI
        materialgroup_id: Filter by materialgroup ID
        articlenumber: Filter by articlenumber (LIKE search)
        is_sub: Filter by packingnote.isSub (True = Unterartikel)
    
    Returns:
        List of articles with their packingnote info:
        {article_id, article_display, description, packingnote_id, is_sub}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        conditions = ["pd.isMaster = 1"]
        params = []
        
        if materialgroup_id:
            conditions.append("a.materialgroup = %s")
            params.append(materialgroup_id)
        
        if articlenumber:
            conditions.append("a.articlenumber LIKE %s")
            params.append(f"%{articlenumber}%")
        
        if is_sub is not None:
            conditions.append("p.isSub = %s")
            params.append(1 if is_sub else 0)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        query = f"""
            SELECT DISTINCT
                a.id AS article_id,
                CONCAT(a.articlenumber, 
                       CASE WHEN a.`index` IS NOT NULL AND a.`index` != '' 
                            THEN CONCAT('-', a.`index`) 
                            ELSE '' 
                       END) AS article_display,
                a.description,
                pr.packingNoteId AS packingnote_id,
                p.isSub AS is_sub
            FROM article a
            INNER JOIN packingnote_details pd ON pd.article = a.id
            INNER JOIN packingnote_relation pr ON pr.detail = pd.id
            INNER JOIN packingnote p ON p.id = pr.packingNoteId
            WHERE {where_clause}
            ORDER BY a.articlenumber ASC
            LIMIT 500
        """
        cursor.execute(query, tuple(params))
        results = cursor.fetchall()
        
        # Convert is_sub to boolean
        for row in results:
            row['is_sub'] = bool(row.get('is_sub', 0))
        
        return results
    finally:
        cursor.close()


def get_bom_content(
    db_connection,
    packingnote_id: int
) -> List[Dict[str, Any]]:
    """
    Lädt BOM-Inhalt mit Hierarchie aus packingnote_relation.
    
    Die Ebene wird aus dem Nested Set (lft/rgt) berechnet:
    Ebene = Anzahl der Vorgänger mit lft < aktuell.lft UND rgt > aktuell.rgt
    
    Args:
        db_connection: MySQL connection to HUGWAWI
        packingnote_id: ID der packingnote
    
    Returns:
        List of BOM items with hierarchy info:
        {detail_id, level, pos, article_display, nettoamount, factor, purchaseprice, salesfactor}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Query with level calculation from Nested Set
        query = """
            SELECT 
                pd.id AS detail_id,
                pd.pos,
                a.articlenumber,
                a.`index` AS article_index,
                a.description,
                pd.nettoamount,
                pd.factor,
                pd.purchaseprice,
                a.salesfactor,
                pr.lft,
                pr.rgt,
                (SELECT COUNT(*) 
                 FROM packingnote_relation pr2 
                 WHERE pr2.packingNoteId = pr.packingNoteId 
                   AND pr2.lft < pr.lft 
                   AND pr2.rgt > pr.rgt) AS level
            FROM packingnote_relation pr
            INNER JOIN packingnote_details pd ON pr.detail = pd.id
            LEFT JOIN article a ON pd.article = a.id
            WHERE pr.packingNoteId = %s
            ORDER BY pr.lft ASC
        """
        cursor.execute(query, (packingnote_id,))
        results = cursor.fetchall()
        
        # Process results to add position levels and article display
        processed = []
        for row in results:
            level = row.get('level', 0)
            pos = row.get('pos', 0)
            
            # Build article display string
            articlenumber = row.get('articlenumber', '') or ''
            article_index = row.get('article_index', '') or ''
            description = row.get('description', '') or ''
            
            article_display = articlenumber
            if article_index:
                article_display += f"-{article_index}"
            if description:
                article_display += f" - ({description})"
            
            # Calculate position levels (1-4)
            pos_level1 = pos if level == 0 else None
            pos_level2 = pos if level == 1 else None
            pos_level3 = pos if level == 2 else None
            pos_level4 = pos if level >= 3 else None
            
            processed.append({
                'detail_id': row.get('detail_id'),
                'level': level,
                'pos': pos,
                'pos_level1': pos_level1,
                'pos_level2': pos_level2,
                'pos_level3': pos_level3,
                'pos_level4': pos_level4,
                'article_display': article_display,
                'nettoamount': row.get('nettoamount'),
                'factor': row.get('factor'),
                'purchaseprice': row.get('purchaseprice'),
                'salesfactor': row.get('salesfactor')
            })
        
        return processed
    finally:
        cursor.close()
