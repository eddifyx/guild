import React from 'react';
function renderPatchNoteItem(item, index, styles) {
  if (typeof item === 'string') {
    return (
      <li key={`note-${index}`} style={styles.patchNoteBullet}>
        {item}
      </li>
    );
  }

  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  const body = typeof item?.body === 'string' ? item.body.trim() : '';

  return (
    <li key={`note-${index}`} style={styles.patchNoteBullet}>
      {title && (
        <div style={{ color: 'rgba(231, 239, 231, 0.96)', fontWeight: 600, marginBottom: body ? 4 : 0 }}>
          {title}
        </div>
      )}
      {body && (
        <div style={{ color: 'rgba(231, 239, 231, 0.72)', lineHeight: 1.55 }}>
          {body}
        </div>
      )}
    </li>
  );
}

export function UpdatePatchNotesPanel({ patchNotes, styles }) {
  return (
    <div style={styles.patchNotesPanel}>
      {patchNotes.headline && (
        <div style={styles.patchNotesHeadline}>{patchNotes.headline}</div>
      )}
      {patchNotes.summary && (
        <div style={styles.patchNotesSummary}>{patchNotes.summary}</div>
      )}
      {patchNotes.sections.map((section, sectionIndex) => (
        <div key={`section-${sectionIndex}`} style={styles.patchNotesSection}>
          {section.title && (
            <div style={styles.patchNotesSectionTitle}>{section.title}</div>
          )}
          {section.items.length > 0 && (
            <ul style={styles.patchNotesList}>
              {section.items.map((item, itemIndex) => renderPatchNoteItem(item, `${sectionIndex}-${itemIndex}`, styles))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
