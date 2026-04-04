export function buildGuildChatDockShellStyle({
  hidden = false,
  fillContainer = false,
  fullscreen = false,
  compact = false,
  dockAligned = false,
  instantHide = false,
  animateEnter = false,
  animateExit = false,
} = {}) {
  return {
    height: hidden ? 0 : fillContainer ? '100%' : fullscreen ? '100%' : compact ? 'clamp(148px, 18vh, 210px)' : 'clamp(384px, 44vh, 560px)',
    minHeight: hidden ? 0 : fillContainer ? 0 : fullscreen ? 0 : compact ? 148 : 384,
    display: 'flex',
    flexDirection: 'column',
    borderTop: fullscreen ? 'none' : '1px solid rgba(64, 255, 64, 0.14)',
    background: 'linear-gradient(180deg, rgba(7, 12, 7, 0.96), rgba(5, 9, 5, 0.98))',
    position: 'relative',
    overflow: 'hidden',
    opacity: hidden ? 0 : 1,
    pointerEvents: hidden ? 'none' : 'auto',
    borderTopColor: hidden || fullscreen ? 'transparent' : 'rgba(64, 255, 64, 0.14)',
    boxShadow: hidden || fullscreen ? 'none' : '0 -18px 38px rgba(0, 0, 0, 0.18)',
    transition: fillContainer
      ? 'opacity 0.12s ease'
      : instantHide
        ? 'opacity 0.12s ease'
        : 'height 0.18s ease, min-height 0.18s ease, opacity 0.12s ease',
    animation: fullscreen
      ? animateExit
        ? 'guildchat-drop-out 210ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
        : animateEnter
          ? 'guildchat-rise-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
          : 'none'
      : 'none',
  };
}

export const guildChatDockAnimationCss = `
  @keyframes guildchat-rise-in {
    from {
      opacity: 0.72;
      transform: translateY(22px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes guildchat-drop-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0.84;
      transform: translateY(120px);
    }
  }
`;
