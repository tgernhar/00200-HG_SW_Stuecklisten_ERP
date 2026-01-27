/**
 * Rich Text Editor Component using TipTap
 * 
 * Features:
 * - Bold, Italic, Underline
 * - Text color
 * - Link insertion
 * - Resizable editor area
 */
import React, { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  maxHeight?: number
}

const styles = {
  container: {
    border: '1px solid #cccccc',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    borderBottom: '1px solid #eeeeee',
    backgroundColor: '#f8f8f8',
    flexWrap: 'wrap' as const,
  },
  toolbarButton: {
    padding: '4px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    minWidth: '28px',
    textAlign: 'center' as const,
  },
  toolbarButtonActive: {
    backgroundColor: '#4a90d9',
    color: '#ffffff',
    border: '1px solid #357abd',
  },
  colorPicker: {
    width: '28px',
    height: '28px',
    padding: '2px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  editor: {
    padding: '10px',
    minHeight: '100px',
    overflow: 'auto',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  linkInput: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    width: '150px',
  },
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Beschreibung eingeben...',
  minHeight = 100,
  maxHeight = 300,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,  // Disable headings
        codeBlock: false,  // Disable code blocks
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; max-height: ${maxHeight}px; overflow-y: auto;`,
        'data-placeholder': placeholder,
      },
    },
  })

  // Handle link insertion
  const handleLinkInsert = useCallback(() => {
    if (!editor) return
    
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL eingeben:', previousUrl || 'https://')
    
    if (url === null) return  // Cancelled
    
    if (url === '') {
      // Remove link
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      // Set/update link
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  // Handle color change
  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return
    editor.chain().focus().setColor(e.target.value).run()
  }, [editor])

  if (!editor) return null

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{
            ...styles.toolbarButton,
            ...(editor.isActive('bold') ? styles.toolbarButtonActive : {}),
            fontWeight: 'bold',
          }}
          title="Fett (Strg+B)"
        >
          B
        </button>
        
        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{
            ...styles.toolbarButton,
            ...(editor.isActive('italic') ? styles.toolbarButtonActive : {}),
            fontStyle: 'italic',
          }}
          title="Kursiv (Strg+I)"
        >
          I
        </button>
        
        {/* Underline */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          style={{
            ...styles.toolbarButton,
            ...(editor.isActive('underline') ? styles.toolbarButtonActive : {}),
            textDecoration: 'underline',
          }}
          title="Unterstrichen (Strg+U)"
        >
          U
        </button>
        
        {/* Color picker */}
        <input
          type="color"
          onChange={handleColorChange}
          style={styles.colorPicker}
          title="Schriftfarbe"
          defaultValue="#000000"
        />
        
        {/* Link */}
        <button
          type="button"
          onClick={handleLinkInsert}
          style={{
            ...styles.toolbarButton,
            ...(editor.isActive('link') ? styles.toolbarButtonActive : {}),
          }}
          title="Link einfügen/bearbeiten"
        >
          🔗
        </button>
        
        {/* Remove link */}
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            style={styles.toolbarButton}
            title="Link entfernen"
          >
            ❌
          </button>
        )}
      </div>
      
      {/* Editor content */}
      <div style={{ ...styles.editor, minHeight, maxHeight }}>
        <EditorContent editor={editor} />
      </div>
      
      {/* Styles for editor content */}
      <style>{`
        .ProseMirror {
          outline: none;
          min-height: inherit;
        }
        .ProseMirror p {
          margin: 0 0 0.5em 0;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror a {
          color: #4a90d9;
          text-decoration: underline;
        }
        .ProseMirror:focus {
          outline: none;
        }
        /* Placeholder styling */
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #aaaaaa;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
