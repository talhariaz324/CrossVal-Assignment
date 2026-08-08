import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        Orders &amp; Settlements
      </Link>
      <nav className="navbar-links">
        <Link to="/orders/new">New order</Link>
        <span className="navbar-user">{user.email}</span>
        <button type="button" onClick={logout} className="link-button">
          Log out
        </button>
      </nav>
    </header>
  );
}
