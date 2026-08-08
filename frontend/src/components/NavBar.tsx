import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LogOutIcon, PlusIcon, SparkIcon } from "./icons";

export function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initial = user.email[0]?.toUpperCase() ?? "?";

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-mark">
          <SparkIcon />
        </span>
        Orders &amp; Settlements
      </Link>
      <nav className="navbar-links">
        <Link to="/orders/new" className="btn btn--secondary btn--sm">
          <PlusIcon />
          New order
        </Link>
        <span className="navbar-user">
          <span className="avatar">{initial}</span>
          {user.email}
        </span>
        <button type="button" onClick={logout} className="icon-btn" aria-label="Log out" title="Log out">
          <LogOutIcon />
        </button>
      </nav>
    </header>
  );
}
