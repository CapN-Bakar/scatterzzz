import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import LobbyPage from "./pages/LobbyPage";
import LeprechaunPage from "./pages/LeprechaunPage";
import WildWestPage from "./pages/WildWestPage";
import MaximusPage from "./pages/MaximusPage"; // NEW
import TsunamiPage from "./pages/TsunamiPage"; // NEW
import WalletPage from "./pages/WalletPage";
import ProfilePage from "./pages/ProfilePage";
import Navbar from "./components/layout/Navbar";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/" /> : <SignupPage />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/leprechaun"
          element={
            <ProtectedRoute>
              <LeprechaunPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/wildwest"
          element={
            <ProtectedRoute>
              <WildWestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/maximus"
          element={
            <ProtectedRoute>
              <MaximusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/tsunami"
          element={
            <ProtectedRoute>
              <TsunamiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <WalletPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
