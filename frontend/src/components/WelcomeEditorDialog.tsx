/**
 * WelcomeEditorDialog Component
 * HTML-Editor Dialog für die Bearbeitung des Willkommenstexts.
 * Verwendet TipTap als WYSIWYG-Editor.
 */
import React, { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'

interface WelcomeEditorDialogProps {
  initialContent: string
  onClose: () => void
  onSave: (html: string) => void
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 5px',
  },
  toolbar: {
    padding: '10px 20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
    backgroundColor: '#f8f8f8',
  },
  toolbarButton: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    minWidth: '32px',
  },
  toolbarButtonActive: {
    backgroundColor: '#4a90d9',
    color: 'white',
    borderColor: '#4a90d9',
  },
  toolbarDivider: {
    width: '1px',
    backgroundColor: '#ddd',
    margin: '0 5px',
  },
  colorInput: {
    width: '32px',
    height: '32px',
    padding: '0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  editorContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    minHeight: '300px',
  },
  editor: {
    minHeight: '250px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
    outline: 'none',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#ccc',
    color: '#666',
    border: '1px solid #aaa',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '14px',
  },
  disabledHint: {
    fontSize: '12px',
    color: '#888',
    alignSelf: 'center',
  },
}

// Color palette for text colors
const COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#cc0000', '#ff0000', '#ff6600', '#ff9900',
  '#009900', '#00cc00', '#006699', '#0099cc',
  '#000099', '#0000ff', '#6600cc', '#9900cc',
]

export default function WelcomeEditorDialog({ 
  initialContent, 
  onClose, 
  onSave 
}: WelcomeEditorDialogProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
        },
      }),
      TextStyle,
      Color,
    ],
    content: initialContent,
  })

  const setLink = useCallback(() => {
    if (!editor) return
    
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL eingeben:', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const setColor = useCallback((color: string) => {
    if (!editor) return
    editor.chain().focus().setColor(color).run()
  }, [editor])

  const insertImage = useCallback(() => {
    if (!editor) return
    
    const url = window.prompt('Bild-URL eingeben:')
    if (url) {
      // Insert image as HTML since we don't have the Image extension
      editor.chain().focus().insertContent(`<img src="${url}" style="max-width: 100%;" />`).run()
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Willkommenstext bearbeiten</h2>
          <button style={styles.closeButton} onClick={onClose}>&times;</button>
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          {/* Text formatting */}
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('bold') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Fett"
          >
            <b>B</b>
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('italic') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Kursiv"
          >
            <i>I</i>
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('underline') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Unterstrichen"
          >
            <u>U</u>
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('strike') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Durchgestrichen"
          >
            <s>S</s>
          </button>

          <div style={styles.toolbarDivider} />

          {/* Headings */}
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('heading', { level: 1 }) ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Überschrift 1"
          >
            H1
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('heading', { level: 2 }) ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Überschrift 2"
          >
            H2
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('heading', { level: 3 }) ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Überschrift 3"
          >
            H3
          </button>

          <div style={styles.toolbarDivider} />

          {/* Lists */}
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('bulletList') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Aufzählung"
          >
            •
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('orderedList') ? styles.toolbarButtonActive : {}),
            }}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Nummerierung"
          >
            1.
          </button>

          <div style={styles.toolbarDivider} />

          {/* Link */}
          <button
            style={{
              ...styles.toolbarButton,
              ...(editor.isActive('link') ? styles.toolbarButtonActive : {}),
            }}
            onClick={setLink}
            title="Link einfügen"
          >
            Link
          </button>

          {/* Image */}
          <button
            style={styles.toolbarButton}
            onClick={insertImage}
            title="Bild einfügen (URL)"
          >
            Bild
          </button>

          <div style={styles.toolbarDivider} />

          {/* Horizontal rule */}
          <button
            style={styles.toolbarButton}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontale Linie"
          >
            ―
          </button>

          <div style={styles.toolbarDivider} />

          {/* Colors */}
          <select
            style={{ ...styles.toolbarButton, width: 'auto', padding: '5px' }}
            onChange={(e) => setColor(e.target.value)}
            value=""
            title="Textfarbe"
          >
            <option value="" disabled>Farbe</option>
            {COLORS.map(color => (
              <option key={color} value={color} style={{ backgroundColor: color, color: color === '#000000' || color === '#333333' ? 'white' : 'black' }}>
                {color}
              </option>
            ))}
          </select>

          <div style={styles.toolbarDivider} />

          {/* Undo/Redo */}
          <button
            style={styles.toolbarButton}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Rückgängig"
          >
            ↶
          </button>
          <button
            style={styles.toolbarButton}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Wiederholen"
          >
            ↷
          </button>
        </div>

        {/* Editor */}
        <div style={styles.editorContainer}>
          <EditorContent 
            editor={editor} 
            style={styles.editor}
          />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.disabledHint}>Speichern ist derzeit deaktiviert</span>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button 
            style={styles.saveButton} 
            disabled
            title="Speichern folgt in einer späteren Version"
          >
            Speichern (deaktiviert)
          </button>
        </div>
      </div>
    </div>
  )
}
