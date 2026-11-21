// Keyboard and mouse state for the game. The rest of the game asks questions
// ("is E down?", "was Enter just pressed?", "where is the mouse?") instead of
// listening to events itself. justPressed is cleared by the loop each frame,
// after the update has read it.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (ev) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    if (!ev.repeat) justPressed.add(ev.code);
    keys.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => keys.delete(ev.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - rect.left;
    mouse.y = ev.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  return {
    mouse,
    down: (code) => keys.has(code),
    pressed: (code) => justPressed.has(code),
    /** Movement axis from WASD and the arrow keys: {x, y} each in -1..1. */
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    /** Call once per frame after the update, so "just pressed" means this frame only. */
    endFrame() {
      justPressed.clear();
      mouse.clicked = false;
    },
  };
}
