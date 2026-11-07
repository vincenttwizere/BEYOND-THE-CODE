import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../useAuth";

const RequireAuth = ({ children, role }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div className="editorial-notice" role="status">Checking your account…</div>;
    }
    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (role && user.role !== role) {
        return <Navigate to="/" replace />;
    }
    return children;
};

export default RequireAuth;
