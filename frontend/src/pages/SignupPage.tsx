import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { AlertTriangleIcon, SparkIcon } from "../components/icons";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-logo">
          <span className="navbar-mark">
            <SparkIcon />
          </span>
          Orders &amp; Settlements
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="auth-form">
            <h1>Sign up</h1>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                <AlertTriangleIcon width={16} height={16} />
                <span>{error}</span>
              </p>
            )}
            <Button type="submit" loading={submitting}>
              Sign up
            </Button>
            <p className="auth-footer">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
