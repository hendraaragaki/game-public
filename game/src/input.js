// Keyboard and pointer input. Held keys give a steering direction and a spray state; one-shot
// presses (start, restart, pause, mute, next tower) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice. The pointer
// aims the spray nozzle and can spray, start and restart; its position is kept in client pixels
// and converted to field coordinates by the caller (the renderer owns the scale).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_NEXT = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SPRAY = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let sprayKey = false;
  let sprayPointer = false;
  let sprayTouch = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (SPRAY.has(event.code)) {
      sprayKey = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (SPRAY.has(event.code)) sprayKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    sprayKey = false;
    sprayPointer = false;
    sprayTouch = false;
  });

  // On-screen touch D-pad (#touch in index.html): the same direction and spray flags as the
  // keyboard, so the game logic never knows which one is held. The buttons are siblings of
  // the canvas, so their presses never reach the canvas pointer handlers; stopPropagation
  // and preventDefault keep a D-pad tap from starting the game or spraying through the
  // canvas. Holding a button holds the direction (like holding a key); each finger is
  // tracked by its own pointer, so LEFT + SPRAY can be held at once.
  const touch = document.getElementById('touch');
  if (touch) {
    const setFlag = (button, on) => {
      const dir = button.dataset.dir;
      if (dir === 'left') left = on;
      else if (dir === 'right') right = on;
      else if (dir === 'up') up = on;
      else if (dir === 'down') down = on;
      else if (button.hasAttribute('data-spray')) sprayTouch = on;
      button.classList.toggle('held', on);
    };
    touch.querySelectorAll('button').forEach((button) => {
      const press = (event) => {
        event.preventDefault();
        event.stopPropagation();
        try { button.setPointerCapture(event.pointerId); } catch { /* no capture: mouse/pen */ }
        setFlag(button, true);
      };
      const release = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setFlag(button, false);
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', () => setFlag(button, false));
      // Older browsers without pointer events: touch events do the same job.
      button.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setFlag(button, true);
      }, { passive: false });
      button.addEventListener('touchend', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setFlag(button, false);
      }, { passive: false });
      button.addEventListener('touchcancel', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setFlag(button, false);
      }, { passive: false });
    });
  }

  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
    sprayPointer = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    sprayPointer = false;
  });

  return {
    /** Steering direction as {x, y}, each -1, 0 or 1, normalised by the caller. */
    direction() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** True while Space, the pointer button, or the touch spray button is held. */
    spraying() {
      return sprayKey || sprayPointer || sprayTouch;
    },
    /** The pointer's last position in client pixels, and whether it has ever moved. */
    mouse() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
