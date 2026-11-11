import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import AuthContext from "./authContext";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        apiRequest("/api/auth/me")
            .then(({ user: currentUser }) => {
                if (isMounted) setUser(currentUser);
            })
            .catch((error) => {
                if (error.message !== "Please log in to continue." && isMounted) {
                    console.error("Could not restore the signed-in user:", error);
                }
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const signIn = async (credentials) => {
        const { user: signedInUser } = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        });
        setUser(signedInUser);
        return signedInUser;
    };

    const signUp = async (details) => {
        const { user: newUser } = await apiRequest("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify(details),
        });
        setUser(newUser);
        return newUser;
    };

    const signOut = async () => {
        await apiRequest("/api/auth/logout", { method: "POST" });
        setUser(null);
    };

    const updateProfile = async (profile) => {
        const { user: updatedUser } = await apiRequest("/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(profile),
        });
        setUser(updatedUser);
        return updatedUser;
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
