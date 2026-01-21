import { Request, Response } from "express";

// DEV AUTH - простая заглушка для разработки
const DEV_USER = {
    id: "dev-user-1",
    email: "user@example.com",
    name: "Dev User",
};

const DEV_PASSWORD = "111111";

// Simple session store (in-memory)
const sessions = new Map<string, any>();

// Generate simple session token
function generateSessionToken() {
    return "dev-session-" + Math.random().toString(36).substr(2, 9);
}

// Sign Up (создание аккаунта)
export const signUp = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        // В dev режиме всегда возвращаем успех
        const token = generateSessionToken();
        const user = {
            id: "dev-user-" + Date.now(),
            email: email || DEV_USER.email,
            name: name || DEV_USER.name,
        };

        sessions.set(token, user);

        // Set session cookie
        res.cookie("dev_session", token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: "lax",
            path: "/",
        });

        res.json({
            user,
            session: {
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Sign In (вход в аккаунт)
export const signIn = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // В dev режиме проверяем демо-учетные данные, но в любом случае авторизуем
        const isValidCredentials =
            (email === DEV_USER.email && password === DEV_PASSWORD) ||
            (!email && !password);

        const token = generateSessionToken();
        const user = {
            id: DEV_USER.id,
            email: email || DEV_USER.email,
            name: DEV_USER.name,
        };

        sessions.set(token, user);

        // Set session cookie
        res.cookie("dev_session", token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: "lax",
            path: "/",
        });

        res.json({
            user,
            session: {
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Get Current Session (получить текущую сессию)
export const getSession = async (req: Request, res: Response) => {
    try {
        let token = req.cookies.dev_session;
        console.log(`[GET_SESSION] token=${token ? token.substring(0, 10) + "..." : "null"}`);

        // В DEV режиме ВСЕГДА возвращаем валидную сессию
        if (process.env.NODE_ENV === "development") {
            if (!token) {
                // Создаём новую dev сессию
                token = generateSessionToken();
                const user = DEV_USER;
                sessions.set(token, user);
                res.cookie("dev_session", token, {
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000,
                    sameSite: "lax",
                    path: "/",
                });
                console.log("[DEV AUTH] Returning fake session - created new token");
                return res.json({
                    user,
                    session: {
                        token,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    },
                });
            }

            const user = sessions.get(token);
            if (!user) {
                // Сессия испортилась в памяти, создаём новую
                console.log("[DEV AUTH] Returning fake session - recreating expired session");
                sessions.set(token, DEV_USER);
                return res.json({
                    user: DEV_USER,
                    session: {
                        token,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    },
                });
            }
        }

        if (!token) {
            console.log("[GET_SESSION] No token, returning null");
            return res.json(null);
        }

        const user = sessions.get(token);
        console.log(`[GET_SESSION] user found=${!!user}`);

        if (!user) {
            console.log("[GET_SESSION] Session expired, clearing cookie");
            res.clearCookie("dev_session");
            return res.json(null);
        }

        console.log(`[GET_SESSION] Returning session for ${user.email}`);
        res.json({
            user,
            session: {
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
        });
    } catch (error: any) {
        console.error("[GET_SESSION] Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};

// Sign Out (выход из аккаунта)
export const signOut = async (req: Request, res: Response) => {
    try {
        const token = req.cookies.dev_session;

        if (token) {
            sessions.delete(token);
        }

        res.clearCookie("dev_session");
        res.json({ message: "Signed out successfully" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
