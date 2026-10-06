// Hash router: "#/active" -> "/active". Calls onRouteChange now and on every URL change.
export function createRouter(onRouteChange) {
  const current = () => window.location.hash.slice(1) || "/";
  window.addEventListener("hashchange", () => onRouteChange(current()));
  onRouteChange(current());
  return { navigate: path => (window.location.hash = path), current };
}
