/* Icons shared by the two management portals; no session or application state. */
window.RiwaqUI = {
  icon(name, size = 18) {
    const element = window.lucide.createElement(window.lucide.icons[name]);
    element.setAttribute('width', size);
    element.setAttribute('height', size);
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('focusable', 'false');
    element.setAttribute('stroke-width', '1.7');
    return element.outerHTML;
  }
};
